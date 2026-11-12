// US-29 diem check-in (toa do + ban kinh mac dinh 150 m, danh muc admin) va US-30 check-in tu dong khi tai xe di
// qua diem: ghi moc cho cac don dang cam, chan trung 30 phut, gui lai sau khi mat mang khong ghi trung, check-in
// tay du phong. Diem thu "KT29-..." dat o vung khong co diem seed (22.0, 104.0).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, Route, ServiceType, PickupLocation, Order, CheckinPoint, CheckinLog } from "../src/models/index.js";
import { distanceM, pointsInRange } from "../src/modules/checkins/geo.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["ci-admin@edms.vn", "ci-kho@edms.vn", "ci-khach@edms.vn", "ci-tx-a@edms.vn", "ci-tx-b@edms.vn", "ci-tx-sai@edms.vn"];
const P1 = { lat: 22.0, lng: 104.0 };
const P2 = { lat: 22.0, lng: 104.02 }; // cach P1 khoang 2 km
const near = (p, metersNorth) => ({ lat: p.lat + metersNorth / 111_320, lng: p.lng });

let app;
let token = {};
let tx = {};
let points = {};
const orders = {};

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const list = await Order.find({ customerId: { $in: ids } }).select("trackingCode").lean();
  if (list.length) await getRedis().del(...list.map((o) => `journey:${o.trackingCode}`));
  await CheckinLog.deleteMany({ $or: [{ shipperId: { $in: ids } }, { orderId: { $in: list.map((o) => o._id) } }] });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await CheckinPoint.deleteMany({ code: /^KT29-/ });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const checkin = (who, body) => as(who, request(app).post("/checkins")).send(body);
const minutes = (n) => new Date(Date.now() - n * 60_000).toISOString();

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hn = await Hub.findOne({ code: "HUB-HN" }).lean();
  const standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [, , , a, b] = await User.create([
    { email: EMAILS[0], phone: "0909982900", passwordHash, fullName: "Admin Check-in", role: "ADMIN" },
    { email: EMAILS[1], phone: "0909982901", passwordHash, fullName: "Kho Check-in", role: "HUB_STAFF", hubId: hn._id },
    { email: EMAILS[2], phone: "0909982902", passwordHash, fullName: "Shop Check-in", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[3], phone: "0909982903", passwordHash, fullName: "Tài xế CI A", role: "SHIPPER" },
    { email: EMAILS[4], phone: "0909982904", passwordHash, fullName: "Tài xế CI B", role: "SHIPPER" },
  ]);
  tx = { a, b };
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { admin: await login(EMAILS[0]), kho: await login(EMAILS[1]), khach: await login(EMAILS[2]), a: await login(EMAILS[3]), b: await login(EMAILS[4]) };

  const location = (
    await as("khach", request(app).post("/pickupLocations")).send({
      label: "Kho", contactName: "Chủ shop", contactPhone: "0909982902", address: "1 Xuân Thủy",
      province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
    })
  ).body.data;
  const create = async (name, status) => {
    const res = await as("khach", request(app).post("/orders")).send({
      pickupLocationId: location._id,
      serviceTypeId: standard._id,
      receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
      item: { name: "Sách", weightGram: 500, length: 20, width: 15, height: 5 },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    // Tai xe A dang cam don (buoc phan cong / lay hang da kiem o US-25, US-28)
    await Order.updateOne({ _id: res.body.data._id }, { $set: { status, assignedTo: a._id } });
    return res.body.data;
  };
  orders.pickup = await create("E2E CI đi lấy", "PICKUP_ASSIGNED");
  orders.carry = await create("E2E CI đang chở", "PICKED_UP");
  orders.done = await create("E2E CI đã giao", "DELIVERED");
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

test("[US-30] khoang cach va geofence: trong ban kinh moi tinh, gan nhat truoc", () => {
  assert.ok(Math.abs(distanceM(P1, near(P1, 100)) - 100) < 1);
  assert.ok(Math.abs(distanceM(P1, P2) - 2063) < 30);
  const list = [
    { code: "A", ...P1, radiusM: 150 },
    { code: "B", ...near(P1, 120), radiusM: 50 },
    { code: "C", ...P2 },
  ];
  assert.deepEqual(pointsInRange(near(P1, 100), list).map((x) => x.point.code), ["B", "A"]);
  assert.deepEqual(pointsInRange(near(P1, 160), list).map((x) => x.point.code), ["B"]);
  assert.deepEqual(pointsInRange(near(P2, 151), list), []);
});

test("[US-29] quan tri diem check-in: ban kinh mac dinh 150 m, kiem toa do, trung ma, chi admin sua; tai xe xem diem dang dung", async () => {
  const created = await as("admin", request(app).post("/checkinPoints")).send({ code: "kt29-p1", name: "KT29 Điểm một", ...P1 }).expect(201);
  assert.deepEqual([created.body.data.code, created.body.data.radiusM], ["KT29-P1", 150]);
  points.p1 = created.body.data;
  points.p2 = (await as("admin", request(app).post("/checkinPoints")).send({ code: "KT29-P2", name: "KT29 Điểm hai", ...P2, radiusM: 200 }).expect(201)).body.data;
  await as("admin", request(app).post("/checkinPoints")).send({ code: "KT29-P1", name: "Trùng", ...P1 }).expect(409);
  await as("admin", request(app).post("/checkinPoints")).send({ code: "KT29-X", name: "Sai", lat: 95, lng: 104 }).expect(400);
  await as("admin", request(app).post("/checkinPoints")).send({ code: "KT29-X", name: "Sai", ...P1, radiusM: 5 }).expect(400);
  await as("admin", request(app).post("/checkinPoints")).send({ code: "KT29-X", name: "Sai", ...P1, hubId: new mongoose.Types.ObjectId() }).expect(400);
  await as("kho", request(app).post("/checkinPoints")).send({ code: "KT29-X", name: "Kho", ...P1 }).expect(403);
  await as("a", request(app).post("/checkinPoints")).send({ code: "KT29-X", name: "TX", ...P1 }).expect(403);

  const off = (await as("admin", request(app).post("/checkinPoints")).send({ code: "KT29-OFF", name: "KT29 Ngừng", ...P1 }).expect(201)).body.data;
  await as("admin", request(app).put(`/checkinPoints/${off._id}`)).send({ isActive: false }).expect(200);
  const visible = (await as("kho", request(app).get("/checkins/points")).expect(200)).body.data.map((p) => p.code);
  assert.ok(visible.includes("KT29-P1") && visible.includes("CP-HN-HUB"), visible.join(","));
  assert.ok(!visible.includes("KT29-OFF"));
  await as("khach", request(app).get("/checkins/points")).expect(403);

  // Moi tai xe mot diem hop le duy nhat: A dang ky KT29-P1 thi chi thay diem do; B chua dang ky thi khong thay diem nao
  await as("admin", request(app).put(`/users/${tx.a._id}`)).send({ checkinPointId: points.p1._id }).expect(200);
  const mine = (await as("a", request(app).get("/checkins/points")).expect(200)).body.data.map((p) => p.code);
  assert.deepEqual(mine, ["KT29-P1"]);
  assert.deepEqual((await as("b", request(app).get("/checkins/points")).expect(200)).body.data, []);
});

test("[US-25] khop vung: tai xe chi phu trach tuyen cung mot hub; diem check-in phai cung vung voi tuyen", async () => {
  const routes = Object.fromEntries((await Route.find({}).lean()).map((r) => [r.code, r._id]));
  const cpHn = await CheckinPoint.findOne({ code: "CP-HN-HUB" }).lean();
  const hn = await as("admin", request(app).put(`/users/${tx.b._id}`)).send({ routeIds: [routes["R-HN-NOI"], routes["R-HCM-NOI"]] }).expect(400);
  assert.match(hn.body.error.message, /cùng một hub/);
  // Bưu cục Đà Nẵng truc thuoc Hub Hà Nội -> cung vung
  await as("admin", request(app).put(`/users/${tx.b._id}`)).send({ routeIds: [routes["R-HN-NOI"], routes["R-DN-NOI"]] }).expect(200);
  await as("admin", request(app).put(`/users/${tx.b._id}`)).send({ routeIds: [routes["R-HCM-NOI"]] }).expect(200);
  const wrongPoint = await as("admin", request(app).put(`/users/${tx.b._id}`)).send({ checkinPointId: cpHn._id }).expect(400);
  assert.match(wrongPoint.body.error.message, /không cùng vùng/);
  // Tao moi cung bi chan
  const created = await as("admin", request(app).post("/users")).send({
    email: "ci-tx-sai@edms.vn", phone: "0909982909", password: "Test@12345", fullName: "Tài xế sai vùng", role: "SHIPPER",
    routeIds: [routes["R-HCM-NOI"]], checkinPointId: cpHn._id,
  });
  assert.equal(created.status, 400, JSON.stringify(created.body));
  await as("admin", request(app).put(`/users/${tx.b._id}`)).send({ routeIds: [] }).expect(200);
});

test("[US-30] tu dong check-in khi di qua diem: ghi moc cho don dang cam; cung diem + cung don chan trung 30 phut", async () => {
  await CheckinLog.deleteMany({ shipperId: tx.a._id });
  const first = (await checkin("a", { ...near(P1, 80), at: minutes(60) }).expect(201)).body.data;
  assert.deepEqual(first.matched.map((m) => m.code), ["KT29-P1"]);
  assert.equal(first.matched[0].distanceM, 80);
  assert.deepEqual([first.orders, first.recorded, first.duplicates, first.source], [2, 2, 0, "AUTO"]);
  assert.equal(await CheckinLog.countDocuments({ orderId: orders.done._id }), 0, "don da giao khong ghi");

  const again = (await checkin("a", { ...near(P1, 20), at: minutes(45) }).expect(201)).body.data;
  assert.deepEqual([again.recorded, again.duplicates], [0, 2], "15 phut sau: trung");
  const later = (await checkin("a", { ...P1, at: minutes(20) }).expect(201)).body.data;
  assert.deepEqual([later.recorded, later.duplicates], [2, 0], "40 phut sau: ghi moc moi");

  // Ngoai ban kinh diem dang ky, hoac o diem khac (P2) -> khong nhan
  const far = await checkin("a", { lat: 22.5, lng: 104.5 }).expect(400);
  assert.match(far.body.error.message, /ngoài bán kính 150 m — chỉ check-in tại điểm đã đăng ký/);
  await checkin("a", { ...P2 }).expect(400);
  // Tai xe chua dang ky diem check-in -> khong nhan
  const other = await checkin("b", { ...P1 }).expect(400);
  assert.match(other.body.error.message, /chưa được đăng ký điểm check-in/);
  await as("kho", request(app).post("/checkins")).send({ ...P1 }).expect(403);
  await checkin("a", { lat: 22 }).expect(400);
});

test("[US-30] mat mang: app gui lai su kien cu (thoi gian goc + ma su kien) khong ghi trung; qua 24 gio hoac tuong lai bi tu choi", async () => {
  await CheckinLog.deleteMany({ shipperId: tx.a._id });
  const queued = { ...near(P1, 30), at: minutes(120), clientEventId: "evt-offline-1" };
  const sent = (await checkin("a", queued).expect(201)).body.data;
  assert.equal(sent.recorded, 2);
  const replay = (await checkin("a", queued).expect(201)).body.data;
  assert.deepEqual([replay.recorded, replay.duplicates], [0, 2]);
  const logs = await CheckinLog.find({ shipperId: tx.a._id }).lean();
  assert.equal(logs.length, 2);
  assert.equal(new Date(logs[0].at).toISOString(), queued.at, "giu thoi diem goc luc mat mang");
  await checkin("a", { ...P1, at: minutes(25 * 60) }).expect(400);
  await checkin("a", { ...P1, at: new Date(Date.now() + 5 * 60_000).toISOString() }).expect(400);
});

test("[US-30] check-in tay du phong: chon diem khi GPS lech (cach toi da 1 km)", async () => {
  await CheckinLog.deleteMany({ shipperId: tx.a._id });
  const manual = (await checkin("a", { ...near(P1, 600), pointId: points.p1._id }).expect(201)).body.data;
  assert.deepEqual([manual.source, manual.recorded], ["MANUAL", 2]);
  assert.ok(Math.abs(manual.matched[0].distanceM - 600) <= 2, String(manual.matched[0].distanceM));
  const tooFar = await checkin("a", { ...near(P1, 1500), pointId: points.p1._id }).expect(400);
  assert.match(tooFar.body.error.message, /quá xa/);
  // Check-in tay tai diem khac diem dang ky -> khong nhan
  const other = await checkin("a", { ...P2, pointId: points.p2._id }).expect(400);
  assert.match(other.body.error.message, /Chỉ check-in tại điểm đã đăng ký: KT29 Điểm một/);
  await checkin("a", { ...P1, pointId: new mongoose.Types.ObjectId() }).expect(400);
});

test("[US-30] luong nghiep vu: tai xe check-in 2 lan o diem dang ky (cach 1 gio), lan o diem khac bi tu choi -> nguoi nhan thay cac lan da qua", async () => {
  await CheckinLog.deleteMany({ shipperId: tx.a._id });
  await checkin("a", { ...P1, at: minutes(90), clientEventId: "evt-flow-1" }).expect(201);
  await checkin("a", { ...near(P1, 50), at: minutes(30), clientEventId: "evt-flow-2" }).expect(201);
  await checkin("a", { ...near(P2, 50), at: minutes(20), clientEventId: "evt-flow-3" }).expect(400);
  // Consumer cua su kien order.status.changed / order.checkin.recorded dung lai hanh trinh
  const container = getContainer();
  await container.orderEventHandlers["order.checkin.recorded"]({ orderId: orders.carry._id, trackingCode: orders.carry.trackingCode });
  const journey = (await request(app).get(`/tracking/${orders.carry.trackingCode}`).expect(200)).body.data;
  assert.deepEqual(journey.checkins.map((c) => c.point), ["KT29 Điểm một", "KT29 Điểm một"]);
  assert.ok(new Date(journey.checkins[0].at) > new Date(journey.checkins[1].at), "moi nhat truoc");
  assert.deepEqual(Object.keys(journey.checkins[0]).sort(), ["at", "point"], "chi ten diem va thoi gian, khong lo toa do");
});
