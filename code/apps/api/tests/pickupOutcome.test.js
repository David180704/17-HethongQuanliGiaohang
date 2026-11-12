// US-28: nguoi giao hang xac nhan da lay hang (quet ma van don, GPS, thoi gian) hoac ghi nhan khong lay duoc
// (bat buoc nguyen nhan, ghi vao hanh trinh). Tuyen R-DN-NOI voi nguoi giao hang rieng cua file nay; ca "KT28 ..."
// ca ngay hom nay.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, Route, ServiceType, PickupLocation, Order, Assignment, Shift } from "../src/models/index.js";
import { parseShiftDate } from "../src/modules/shifts/shifts.validator.js";
import { vnNow } from "../src/modules/assignments/AssignmentService.js";
import { parseLocation, parsePickedUp, parsePickupFailed } from "../src/modules/assignments/pickupOutcome.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["lh-kho-hn@edms.vn", "lh-khach@edms.vn", "lh-tx-a@edms.vn", "lh-tx-b@edms.vn"];
const GPS = { lat: 16.0678, lng: 108.2208 };

let app;
let service;
let token = {};
let routes;
let standard;
let location;
let tx = {};

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Assignment.deleteMany({ $or: [{ orderId: { $in: orders.map((o) => o._id) } }, { shipperId: { $in: ids } }] });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await Shift.deleteMany({ name: /^KT28 / });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);

/** Khach tao don lay o Da Nang -> kho HN duyet -> phan cong tu dong cho nguoi trong ca KT28. */
async function assignedOrder(name) {
  const created = await as("khach", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
    item: { name: "Áo thun", weightGram: 500, length: 20, width: 15, height: 5 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  await as("hn", request(app).post(`/orders/${created.body.data._id}/confirm`)).expect(200);
  const result = await service.autoAssignPickup(created.body.data._id);
  assert.equal(result.status, "ASSIGNED", JSON.stringify(result));
  return { ...created.body.data, shipperName: result.shipper.fullName };
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  service = getContainer().assignmentService;
  const hn = await Hub.findOne({ code: "HUB-HN" }).lean();
  routes = Object.fromEntries((await Route.find({}).lean()).map((r) => [r.code, r]));
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const shipper = (i, fullName) => ({
    email: EMAILS[i], phone: `090998270${i}`, passwordHash, fullName, role: "SHIPPER", routeIds: [routes["R-DN-NOI"]._id],
  });
  const [, , a, b] = await User.create([
    { email: EMAILS[0], phone: "0909982700", passwordHash, fullName: "Kho HN Lấy hàng", role: "HUB_STAFF", hubId: hn._id },
    { email: EMAILS[1], phone: "0909982701", passwordHash, fullName: "Shop Lấy hàng", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    shipper(2, "Tài xế LH A"),
    shipper(3, "Tài xế LH B"),
  ]);
  tx = { a, b };
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { hn: await login(EMAILS[0]), khach: await login(EMAILS[1]), a: await login(EMAILS[2]), b: await login(EMAILS[3]) };
  location = (
    await as("khach", request(app).post("/pickupLocations")).send({
      label: "Kho Đà Nẵng", contactName: "Chủ shop", contactPhone: "0909982701", address: "10 Bạch Đằng",
      province: "Đà Nẵng", ward: "Phường Hải Châu",
    })
  ).body.data;
});

beforeEach(async () => {
  await Assignment.deleteMany({ shipperId: { $in: [tx.a._id, tx.b._id] } });
  await Shift.deleteMany({ name: /^KT28 / });
  const day = vnNow(new Date()).day;
  // Chi tai xe A trong ca -> moi don tu phan cong cho A
  await Shift.create({
    code: `KT28-${day}`, name: "KT28 Ca ngày", startTime: "00:00", endTime: "23:59", routeId: routes["R-DN-NOI"]._id,
    shiftDate: parseShiftDate(day), shipperIds: [tx.a._id],
  });
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

test("[US-28] kiem tra du lieu: ma van don phai khop kien, toa do GPS bat buoc va hop le, nguyen nhan bat buoc", () => {
  assert.deepEqual(parseLocation({ lat: "16.06", lng: 108.22 }), { lat: 16.06, lng: 108.22 });
  assert.throws(() => parseLocation({ lat: 16 }), /Thiếu tọa độ/);
  assert.throws(() => parseLocation({ lat: 91, lng: 0 }), /không hợp lệ/);
  assert.deepEqual(parsePickedUp({ code: " exp1000000001 ", ...GPS }, "EXP1000000001").location, GPS);
  assert.throws(() => parsePickedUp({ code: "EXP1000000002", ...GPS }, "EXP1000000001"), /không khớp/);
  assert.throws(() => parsePickedUp({ ...GPS }, "EXP1000000001"), /Quét hoặc nhập/);
  assert.equal(parsePickupFailed({ reason: "NOT_READY", ...GPS }).reason, "NOT_READY");
  assert.throws(() => parsePickupFailed({ ...GPS }), /Chọn nguyên nhân/);
  assert.throws(() => parsePickupFailed({ reason: "OTHER", note: "x", ...GPS }), /ghi rõ/);
  assert.equal(parsePickupFailed({ reason: "OTHER", note: "Shop chuyển nhà", ...GPS }).note, "Shop chuyển nhà");
});

test("[US-28] xac nhan da lay: quet dung ma -> PICKED_UP, ghi GPS va thoi gian vao hanh trinh va phan cong; khong bam lai duoc", async () => {
  const order = await assignedOrder("E2E LH lấy được");
  const url = `/assignments/pickups/${order._id}/picked`;
  await as("a", request(app).post(url)).send({ code: "EXP0000000000", ...GPS }).expect(400);
  await as("a", request(app).post(url)).send({ code: order.trackingCode }).expect(400);
  await as("b", request(app).post(url)).send({ code: order.trackingCode, ...GPS }).expect(404);
  await as("hn", request(app).post(url)).send({ code: order.trackingCode, ...GPS }).expect(403);

  const res = await as("a", request(app).post(url)).send({ code: order.trackingCode.toLowerCase(), ...GPS }).expect(200);
  assert.equal(res.body.data.status, "PICKED_UP");
  const saved = await Order.findById(order._id).lean();
  const last = saved.statusHistory.at(-1);
  assert.equal(last.status, "PICKED_UP");
  assert.deepEqual(last.location, GPS);
  assert.equal(String(last.by), String(tx.a._id));
  const assignment = await Assignment.findOne({ orderId: order._id }).lean();
  assert.equal(assignment.status, "DONE");
  assert.deepEqual(assignment.location, GPS);
  assert.ok(assignment.doneAt);
  await as("a", request(app).post(url)).send({ code: order.trackingCode, ...GPS }).expect(409);

  const mine = (await as("a", request(app).get("/assignments/mine/pickups")).expect(200)).body.data;
  assert.deepEqual([mine.counts.toPick, mine.counts.done], [0, 1]);
});

test("[US-28] khong lay duoc: bat buoc nguyen nhan, ghi vao hanh trinh; kho thay o bang phan cong va giao lai", async () => {
  const order = await assignedOrder("E2E LH không lấy được");
  const url = `/assignments/pickups/${order._id}/failed`;
  await as("a", request(app).post(url)).send({ ...GPS }).expect(400);
  await as("a", request(app).post(url)).send({ reason: "OTHER", ...GPS }).expect(400);
  const res = await as("a", request(app).post(url)).send({ reason: "NOT_READY", note: "Shop hẹn chiều", ...GPS }).expect(200);
  assert.equal(res.body.data.status, "PICKUP_FAILED");
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.statusHistory.at(-1).note, "Không lấy được hàng: Hàng chưa sẵn sàng — Shop hẹn chiều");
  const assignment = await Assignment.findOne({ orderId: order._id }).lean();
  assert.deepEqual([assignment.status, assignment.failReason], ["FAILED", "NOT_READY"]);

  // Kho thay don trong muc "lay khong duoc", giao lai cho chinh A (hen lai) - bat buoc ly do
  const board = (await as("hn", request(app).get("/assignments/pickup")).expect(200)).body.data;
  const row = board.failed.find((o) => o.trackingCode === order.trackingCode);
  assert.match(row.failNote, /Hàng chưa sẵn sàng/);
  assert.equal(row.assignedTo.fullName, "Tài xế LH A");
  await as("hn", request(app).post("/assignments/pickup")).send({ orderId: order._id, shipperId: tx.a._id, reason: "Shop hẹn lấy lại chiều nay" }).expect(201);
  assert.equal((await Order.findById(order._id).lean()).status, "PICKUP_ASSIGNED");
  const mine = (await as("a", request(app).get("/assignments/mine/pickups")).expect(200)).body.data;
  assert.equal(mine.counts.toPick, 1);
  assert.equal(mine.counts.failed, 1);

  const reasons = (await as("a", request(app).get("/assignments/pickup-fail-reasons")).expect(200)).body.data;
  assert.equal(reasons.length, 6);
  assert.deepEqual(reasons[0], { code: "SHOP_UNREACHABLE", label: "Không liên lạc được người gửi" });
});

test("[US-28] luong nghiep vu: shop tao don -> kho duyet -> tu phan cong -> tai xe quet ma lay hang -> khach va nguoi nhan thay Da lay hang", async () => {
  const order = await assignedOrder("E2E LH luồng");
  assert.equal(order.shipperName, "Tài xế LH A");
  await as("a", request(app).post(`/assignments/pickups/${order._id}/picked`)).send({ code: order.trackingCode, ...GPS }).expect(200);
  // Khach thay nhom "Da nhan - Chua giao"
  const mine = (await as("khach", request(app).get(`/orders/${order._id}`)).expect(200)).body.data;
  assert.equal(mine.status, "PICKED_UP");
  assert.equal(mine.display.groupLabel, "Đã nhận – Chưa giao");
  // Nguoi nhan tra cuu cong khai: hanh trinh dung lai tu du lieu goc co moc da lay hang
  await getRedis().del(`journey:${order.trackingCode}`);
  const journey = (await request(app).get(`/tracking/${order.trackingCode}`).expect(200)).body.data;
  assert.deepEqual(journey.events.map((e) => e.status).sort(), ["CONFIRMED", "CREATED", "PICKED_UP", "PICKUP_ASSIGNED"]);
  assert.equal(journey.groupLabel, "Đã nhận – Chưa giao");
});
