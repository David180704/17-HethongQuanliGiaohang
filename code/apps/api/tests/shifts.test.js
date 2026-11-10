// US-23: ca lam viec - nhan vien kho lap ca theo ngay cho cac tuyen thuoc hub minh (va buu cuc truc thuoc),
// gan nguoi giao hang phu trach tuyen; khong trung gio cung ngay. Dung nguoi giao hang rieng va ngay rieng
// (03/2027) de khong dung du lieu seed va cac file test khac.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, Route, Shift } from "../src/models/index.js";
import { shiftValidator } from "../src/modules/shifts/shifts.validator.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["shf-kho-hn@edms.vn", "shf-kho-hcm@edms.vn", "shf-admin@edms.vn", "shf-tx-a@edms.vn", "shf-tx-b@edms.vn", "shf-tx-hcm@edms.vn", "shf-khach@edms.vn"];
const DAY = "2027-03-15";

let app;
let token = {};
let routes;
let tx = {};

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  await Shift.deleteMany({ $or: [{ shipperIds: { $in: ids } }, { name: /^KT23 / }] });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const shiftBody = (overrides = {}) => ({
  routeId: routes["R-HN-NOI"]._id,
  name: "KT23 Ca sáng",
  shiftDate: DAY,
  startTime: "08:00",
  endTime: "12:00",
  shipperIds: [tx.a._id],
  ...overrides,
});

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "HUB-HCM"] } }).lean()).map((h) => [h.code, h]));
  routes = Object.fromEntries((await Route.find({}).lean()).map((r) => [r.code, r]));
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const shipper = (email, phone, fullName, routeIds) => ({ email, phone, passwordHash, fullName, role: "SHIPPER", routeIds });
  const [, , , a, b, hcm] = await User.create([
    { email: EMAILS[0], phone: "0909982401", passwordHash, fullName: "Kho HN Ca", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[1], phone: "0909982402", passwordHash, fullName: "Kho HCM Ca", role: "HUB_STAFF", hubId: hubs["HUB-HCM"]._id },
    { email: EMAILS[2], phone: "0909982403", passwordHash, fullName: "Admin Ca", role: "ADMIN" },
    shipper(EMAILS[3], "0909982404", "Tài xế Ca A", [routes["R-HN-NOI"]._id, routes["R-DN-NOI"]._id]),
    shipper(EMAILS[4], "0909982405", "Tài xế Ca B", [routes["R-HN-NOI"]._id]),
    shipper(EMAILS[5], "0909982406", "Tài xế Ca HCM", [routes["R-HCM-NOI"]._id]),
    { email: EMAILS[6], phone: "0909982407", passwordHash, fullName: "Khách Ca", role: "CUSTOMER", customerType: "INDIVIDUAL" },
  ]);
  tx = { a, b, hcm };
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { hn: await login(EMAILS[0]), hcm: await login(EMAILS[1]), admin: await login(EMAILS[2]), khach: await login(EMAILS[6]) };
});

after(async () => {
  try {
    await cleanup();
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-23] kiem tra du lieu ca: gio HH:mm, ket thuc sau bat dau, ngay ton tai", () => {
  const base = { routeId: "r", name: "Ca", shiftDate: "2027-03-15", startTime: "08:00", endTime: "12:00" };
  assert.equal(shiftValidator.create(base).startTime, "08:00");
  assert.equal(shiftValidator.create(base).shiftDate.toISOString(), "2027-03-14T17:00:00.000Z", "00:00 gio Viet Nam");
  assert.throws(() => shiftValidator.create({ ...base, endTime: "08:00" }), /sau giờ bắt đầu/);
  assert.throws(() => shiftValidator.create({ ...base, startTime: "8:00" }), /HH:mm/);
  assert.throws(() => shiftValidator.create({ ...base, endTime: "24:00" }), /HH:mm/);
  assert.throws(() => shiftValidator.create({ ...base, shiftDate: "2027-02-30" }), /không tồn tại/);
});

test("[US-23] nhan vien kho tao ca cho tuyen cua hub minh, gan nguoi giao hang; xem theo ngay", async () => {
  const res = await as("hn", request(app).post("/shifts")).send(shiftBody());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.code, "R-HN-NOI-20270315-0800");
  assert.equal(res.body.data.routeId.code, "R-HN-NOI");
  assert.deepEqual(res.body.data.shipperIds.map((s) => s.fullName), ["Tài xế Ca A"]);

  const list = await as("hn", request(app).get(`/shifts?date=${DAY}`));
  assert.ok(list.body.data.some((s) => s.code === "R-HN-NOI-20270315-0800"));
  // Tuyen cua buu cuc truc thuoc (PO-DN thuoc HUB-HN) cung trong pham vi
  const dn = await as("hn", request(app).post("/shifts")).send(shiftBody({ routeId: routes["R-DN-NOI"]._id, startTime: "13:00", endTime: "17:00" }));
  assert.equal(dn.status, 201, JSON.stringify(dn.body));
});

test("[US-23] pham vi: kho HN khong lap ca tuyen HCM, kho HCM khong thay ca HN; khach hang bi chan", async () => {
  const other = await as("hn", request(app).post("/shifts")).send(shiftBody({ routeId: routes["R-HCM-NOI"]._id, shipperIds: [tx.hcm._id] }));
  assert.equal(other.status, 404);
  const hcmList = await as("hcm", request(app).get(`/shifts?date=${DAY}`));
  assert.ok(!hcmList.body.data.some((s) => s.code.startsWith("R-HN-NOI")));
  const adminList = await as("admin", request(app).get(`/shifts?date=${DAY}`));
  assert.ok(adminList.body.data.some((s) => s.code.startsWith("R-HN-NOI")), "admin thay het");
  assert.equal((await as("khach", request(app).get("/shifts"))).status, 403);
});

test("[US-23] rang buoc: nguoi khong phu trach tuyen -> 400; trung gio cung ngay -> 409; ca noi tiep thi duoc", async () => {
  const wrongRoute = await as("hn", request(app).post("/shifts")).send(shiftBody({ shipperIds: [tx.hcm._id], startTime: "18:00", endTime: "20:00" }));
  assert.equal(wrongRoute.status, 400);
  assert.match(wrongRoute.body.error.message, /không phụ trách tuyến R-HN-NOI/);

  // A da co ca 08:00-12:00 (R-HN-NOI) va 13:00-17:00 (R-DN-NOI) -> ca 11:00-14:00 trung ca hai
  const clash = await as("hn", request(app).post("/shifts")).send(shiftBody({ startTime: "11:00", endTime: "14:00", name: "KT23 Ca trưa" }));
  assert.equal(clash.status, 409);
  assert.match(clash.body.error.message, /Tài xế Ca A đã có ca/);

  const sameStart = await as("hn", request(app).post("/shifts")).send(shiftBody({ shipperIds: [tx.b._id], endTime: "10:00" }));
  assert.equal(sameStart.status, 409, "cung tuyen cung gio bat dau");

  const nextShift = await as("hn", request(app).post("/shifts")).send(shiftBody({ startTime: "17:00", endTime: "21:00", name: "KT23 Ca tối" }));
  assert.equal(nextShift.status, 201, "17:00 noi tiep ca 13:00-17:00, khong trung");
});

test("[US-23] sua ca them nguoi, kiem trung gio khi sua; xoa ca; lua chon form chi gom tuyen trong pham vi", async () => {
  const created = (await as("hn", request(app).post("/shifts")).send(shiftBody({ startTime: "05:00", endTime: "07:00", shipperIds: [], name: "KT23 Ca sớm" }))).body.data;
  const added = await as("hn", request(app).put(`/shifts/${created._id}`)).send({ shipperIds: [tx.a._id, tx.b._id] });
  assert.equal(added.status, 200, JSON.stringify(added.body));
  assert.deepEqual(added.body.data.shipperIds.map((s) => s.fullName).sort(), ["Tài xế Ca A", "Tài xế Ca B"]);
  const clash = await as("hn", request(app).put(`/shifts/${created._id}`)).send({ endTime: "09:00" });
  assert.equal(clash.status, 409, "keo dai sang ca sang cua A -> trung");
  assert.equal((await as("hn", request(app).delete(`/shifts/${created._id}`))).status, 200);
  assert.equal(await Shift.countDocuments({ _id: created._id }), 0);
  assert.equal((await as("hcm", request(app).delete(`/shifts/${created._id}`))).status, 404);

  const options = (await as("hn", request(app).get("/shifts/options"))).body.data;
  const codes = options.routes.map((r) => r.code);
  assert.ok(codes.includes("R-HN-NOI") && codes.includes("R-DN-NOI") && !codes.includes("R-HCM-NOI"));
  const hnNoi = options.routes.find((r) => r.code === "R-HN-NOI");
  assert.ok(hnNoi.shippers.some((s) => s.fullName === "Tài xế Ca B"));
  assert.ok(!hnNoi.shippers.some((s) => s.fullName === "Tài xế Ca HCM"));
});

test("[US-23] luong nghiep vu: kho lap ca sang + chieu cho tuyen, chia nguoi; ngay do moi tuyen thay dung nguoi theo ca", async () => {
  const day = "2027-03-16";
  const morning = await as("hn", request(app).post("/shifts")).send(shiftBody({ shiftDate: day, shipperIds: [tx.a._id, tx.b._id] }));
  const afternoon = await as("hn", request(app).post("/shifts")).send(
    shiftBody({ shiftDate: day, name: "KT23 Ca chiều", startTime: "13:00", endTime: "17:30", shipperIds: [tx.b._id] }),
  );
  assert.equal(morning.status, 201);
  assert.equal(afternoon.status, 201);
  // B nghi chieu -> bo B khoi ca chieu, them A
  const swap = await as("hn", request(app).put(`/shifts/${afternoon.body.data._id}`)).send({ shipperIds: [tx.a._id] });
  assert.equal(swap.status, 200);
  const list = (await as("hn", request(app).get(`/shifts?date=${day}&routeId=${routes["R-HN-NOI"]._id}`))).body.data;
  assert.deepEqual(
    list.map((s) => [s.name, s.startTime, s.shipperIds.map((p) => p.fullName).sort().join("+")]),
    [
      ["KT23 Ca sáng", "08:00", "Tài xế Ca A+Tài xế Ca B"],
      ["KT23 Ca chiều", "13:00", "Tài xế Ca A"],
    ],
  );
});

test("[US-23] nguoi giao hang xem ca cua minh theo ngay; nguoi khong phai tai xe bi chan", async () => {
  const day = "2027-03-17";
  await as("hn", request(app).post("/shifts")).send(shiftBody({ shiftDate: day, shipperIds: [tx.b._id] }));
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token.txB = await login(EMAILS[4]);
  token.txA = await login(EMAILS[3]);
  const mineB = await as("txB", request(app).get(`/shifts/mine?date=${day}`));
  assert.equal(mineB.status, 200);
  assert.deepEqual(mineB.body.data.map((s) => [s.name, s.routeId.code]), [["KT23 Ca sáng", "R-HN-NOI"]]);
  assert.deepEqual((await as("txA", request(app).get(`/shifts/mine?date=${day}`))).body.data, [], "A khong co ca ngay nay");
  assert.equal((await as("hn", request(app).get("/shifts/mine"))).status, 403);
});
