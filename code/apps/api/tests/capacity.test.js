// US-24: nang luc toi da moi ca, 3 cap uu tien: rieng nguoi giao hang -> tuyen -> mac dinh he thong.
// Dung nguoi giao hang rieng; nang luc tuyen R-DN-NOI va mac dinh he thong doi trong test duoc tra lai o after().
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, Route } from "../src/models/index.js";
import { Setting } from "../src/models/Setting.js";
import { effectiveCapacity, parseCapacityInput, DEFAULT_CAPACITY } from "../src/modules/capacity/capacity.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["cap-kho-hn@edms.vn", "cap-kho-hcm@edms.vn", "cap-admin@edms.vn", "cap-tx-a@edms.vn", "cap-tx-b@edms.vn"];

let app;
let token = {};
let routes;
let tx = {};
let savedRoute;
let savedSetting;

async function cleanup() {
  await User.deleteMany({ email: { $in: EMAILS } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const routeView = (body, code) => body.data.routes.find((r) => r.code === code);
const shipperView = (body, code, id) => routeView(body, code).shippers.find((s) => String(s._id) === String(id));

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "HUB-HCM"] } }).lean()).map((h) => [h.code, h]));
  routes = Object.fromEntries((await Route.find({}).lean()).map((r) => [r.code, r]));
  savedRoute = { maxPickupPerShift: routes["R-DN-NOI"].maxPickupPerShift, maxDeliveryPerShift: routes["R-DN-NOI"].maxDeliveryPerShift };
  savedSetting = await Setting.findById("capacity").lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [, , , a, b] = await User.create([
    { email: EMAILS[0], phone: "0909982501", passwordHash, fullName: "Kho HN Năng lực", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[1], phone: "0909982502", passwordHash, fullName: "Kho HCM Năng lực", role: "HUB_STAFF", hubId: hubs["HUB-HCM"]._id },
    { email: EMAILS[2], phone: "0909982503", passwordHash, fullName: "Admin Năng lực", role: "ADMIN" },
    { email: EMAILS[3], phone: "0909982504", passwordHash, fullName: "Tài xế NL A", role: "SHIPPER", routeIds: [routes["R-DN-NOI"]._id] },
    { email: EMAILS[4], phone: "0909982505", passwordHash, fullName: "Tài xế NL B", role: "SHIPPER", routeIds: [routes["R-DN-NOI"]._id] },
  ]);
  tx = { a, b };
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { hn: await login(EMAILS[0]), hcm: await login(EMAILS[1]), admin: await login(EMAILS[2]), tx: await login(EMAILS[3]) };
});

after(async () => {
  try {
    await cleanup();
    await Route.updateOne({ _id: routes["R-DN-NOI"]._id }, { $set: savedRoute });
    if (savedSetting) await Setting.replaceOne({ _id: "capacity" }, savedSetting);
    else await Setting.deleteOne({ _id: "capacity" });
    await getContainer().cache.invalidate("routes", "users");
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-24] thu tu uu tien nang luc: nguoi giao hang -> tuyen -> mac dinh he thong", () => {
  const system = { maxPickupPerShift: 12, maxDeliveryPerShift: 18 };
  const route = { maxPickupPerShift: 15, maxDeliveryPerShift: null };
  assert.deepEqual(effectiveCapacity({ shipper: { maxPickupPerShift: 6 }, route, system }, "pickup"), { value: 6, source: "USER" });
  assert.deepEqual(effectiveCapacity({ shipper: { maxPickupPerShift: null }, route, system }, "pickup"), { value: 15, source: "ROUTE" });
  assert.deepEqual(effectiveCapacity({ shipper: {}, route, system }, "delivery"), { value: 18, source: "SYSTEM" });
  assert.deepEqual(effectiveCapacity({}, "delivery"), { value: DEFAULT_CAPACITY.maxDeliveryPerShift, source: "SYSTEM" });
  assert.throws(() => effectiveCapacity({}, "return"));
  assert.deepEqual(parseCapacityInput({ maxPickupPerShift: "8" }), { maxPickupPerShift: 8 });
  assert.deepEqual(parseCapacityInput({ maxDeliveryPerShift: null }, { allowNull: true }), { maxDeliveryPerShift: null });
  for (const bad of [0, 501, 2.5, "abc", null]) {
    assert.throws(() => parseCapacityInput({ maxPickupPerShift: bad }), /từ 1 đến 500/, String(bad));
  }
});

test("[US-24] tong quan nang luc: kho HN thay tuyen hub minh + buu cuc truc thuoc, khong thay tuyen HCM", async () => {
  const res = await as("hn", request(app).get("/capacity")).expect(200);
  const codes = res.body.data.routes.map((r) => r.code);
  assert.ok(codes.includes("R-HN-NOI") && codes.includes("R-DN-NOI"), codes.join(","));
  assert.ok(!codes.includes("R-HCM-NOI"));
  const a = shipperView(res.body, "R-DN-NOI", tx.a._id);
  assert.deepEqual(a.pickup, { value: routes["R-DN-NOI"].maxPickupPerShift, source: "ROUTE" });
  assert.ok(res.body.data.system.maxPickupPerShift > 0);
  await as("tx", request(app).get("/capacity")).expect(403);
  await request(app).get("/capacity").expect(401);
});

test("[US-24] mac dinh he thong chi quan tri vien doi; nhan vien kho bi chan; gia tri sai -> 400", async () => {
  await as("hn", request(app).put("/capacity/system")).send({ maxPickupPerShift: 10 }).expect(403);
  await as("admin", request(app).put("/capacity/system")).send({ maxPickupPerShift: 0 }).expect(400);
  await as("admin", request(app).put("/capacity/system")).send({}).expect(400);
  const res = await as("admin", request(app).put("/capacity/system")).send({ maxPickupPerShift: 11, maxDeliveryPerShift: 22 }).expect(200);
  assert.deepEqual(res.body.data, { maxPickupPerShift: 11, maxDeliveryPerShift: 22 });
});

test("[US-24] nang luc tuyen va nguoi giao hang chi doi trong pham vi hub; null = bo ghi de", async () => {
  await as("hcm", request(app).put(`/capacity/routes/${routes["R-DN-NOI"]._id}`)).send({ maxPickupPerShift: 9 }).expect(404);
  await as("hcm", request(app).put(`/capacity/shippers/${tx.a._id}`)).send({ maxPickupPerShift: 3 }).expect(404);
  await as("hn", request(app).put(`/capacity/shippers/${tx.a._id}`)).send({ maxPickupPerShift: 501 }).expect(400);
  const set = await as("hn", request(app).put(`/capacity/shippers/${tx.a._id}`)).send({ maxPickupPerShift: 3 }).expect(200);
  assert.equal(set.body.data.maxPickupPerShift, 3);
  const reset = await as("hn", request(app).put(`/capacity/shippers/${tx.a._id}`)).send({ maxPickupPerShift: null }).expect(200);
  assert.equal(reset.body.data.maxPickupPerShift, null);
  const khach = await User.findOne({ role: "CUSTOMER" }).lean();
  await as("admin", request(app).put(`/capacity/shippers/${khach._id}`)).send({ maxPickupPerShift: 3 }).expect(404);
});

test("[US-24] luong nghiep vu: admin dat mac dinh -> kho dat nang luc tuyen -> dat rieng cho mot tai xe -> bo ghi de", async () => {
  const code = "R-DN-NOI";
  const look = async () => (await as("hn", request(app).get("/capacity")).expect(200)).body;

  // 1. Tuyen khong co gia tri hop le -> dung mac dinh he thong (mo phong tuyen cu thieu cau hinh)
  await Route.updateOne({ _id: routes[code]._id }, { $set: { maxPickupPerShift: 0, maxDeliveryPerShift: 0 } });
  await as("admin", request(app).put("/capacity/system")).send({ maxPickupPerShift: 14, maxDeliveryPerShift: 24 }).expect(200);
  let body = await look();
  assert.deepEqual(shipperView(body, code, tx.a._id).pickup, { value: 14, source: "SYSTEM" });
  assert.deepEqual(shipperView(body, code, tx.b._id).delivery, { value: 24, source: "SYSTEM" });

  // 2. Kho dat nang luc tuyen -> ca hai tai xe theo tuyen
  await as("hn", request(app).put(`/capacity/routes/${routes[code]._id}`)).send({ maxPickupPerShift: 9, maxDeliveryPerShift: 16 }).expect(200);
  body = await look();
  assert.deepEqual(shipperView(body, code, tx.a._id).pickup, { value: 9, source: "ROUTE" });
  assert.deepEqual(shipperView(body, code, tx.b._id).pickup, { value: 9, source: "ROUTE" });

  // 3. Rieng tai xe A nhan it don lay hon (moi vao nghe) -> A theo ca nhan, B van theo tuyen
  await as("hn", request(app).put(`/capacity/shippers/${tx.a._id}`)).send({ maxPickupPerShift: 4 }).expect(200);
  body = await look();
  assert.deepEqual(shipperView(body, code, tx.a._id).pickup, { value: 4, source: "USER" });
  assert.deepEqual(shipperView(body, code, tx.a._id).delivery, { value: 16, source: "ROUTE" });
  assert.deepEqual(shipperView(body, code, tx.b._id).pickup, { value: 9, source: "ROUTE" });
  const service = getContainer().capacityService;
  const fresh = await User.findById(tx.a._id).lean();
  assert.deepEqual(await service.capacityOf(fresh, await Route.findById(routes[code]._id).lean(), "pickup"), { value: 4, source: "USER" });

  // 4. Bo ghi de -> A tro lai theo tuyen
  await as("hn", request(app).put(`/capacity/shippers/${tx.a._id}`)).send({ maxPickupPerShift: null }).expect(200);
  body = await look();
  assert.deepEqual(shipperView(body, code, tx.a._id).pickup, { value: 9, source: "ROUTE" });
});
