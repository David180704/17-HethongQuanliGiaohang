// Sprint 6 (de 02): US-35 phan cong giao, US-31 danh sach + phieu giao QR, US-32 giao thanh cong / that bai,
// US-33 thu COD cung transaction, US-36 giao lai toi da N lan, US-37 hoan hang den khi shop xac nhan.
// Giao tren tuyen R-DN-NOI (kho dich PO-DN, truc thuoc HUB-HN): tai xe va ca "KT35 ..." rieng cua file nay;
// hoan hang ve dia diem lay hang o Ha Noi (tuyen R-HN-NOI, tai xe hoan rieng).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, Route, ServiceType, PickupLocation, Order, Assignment, Shift } from "../src/models/index.js";
import { Setting } from "../src/models/Setting.js";
import { parseShiftDate } from "../src/modules/shifts/shifts.validator.js";
import { vnNow } from "../src/modules/assignments/AssignmentService.js";
import { afterFailedDelivery, amountToCollect } from "../src/modules/delivery/deliveryPolicy.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = [
  "gh-kho-hn@edms.vn",
  "gh-shop@edms.vn",
  "gh-shop-khac@edms.vn",
  "gh-tx-a@edms.vn",
  "gh-tx-b@edms.vn",
  "gh-tx-hcm@edms.vn",
  "gh-tx-hoan@edms.vn",
  "gh-admin@edms.vn",
];
const GPS = { lat: 16.0678, lng: 108.2208 };

let app;
let service;
let token = {};
let routes;
let standard;
let express;
let hnLocation;
let dnLocation;
let tx = {};
let worker;

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("_id trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Assignment.deleteMany({ $or: [{ orderId: { $in: orders.map((o) => o._id) } }, { shipperId: { $in: ids } }] });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await Shift.deleteMany({ name: /^KT35 / });
  await User.deleteMany({ _id: { $in: ids } });
  await Setting.deleteOne({ _id: "delivery" });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const today = () => parseShiftDate(vnNow(new Date()).day);

/**
 * Don cua shop da toi kho dich PO-DN (cac buoc lay hang, kho trung chuyen da kiem o US-28, US-41).
 * from: "HN" (lien tinh, chi giao tieu chuan) | "DN" (noi tinh, giao nhanh duoc).
 */
async function atDestHub(name, { from = "HN", serviceType = standard, cod } = {}) {
  const created = await as("shop", request(app).post("/orders")).send({
    pickupLocationId: (from === "DN" ? dnLocation : hnLocation)._id,
    serviceTypeId: serviceType._id,
    receiver: { name, phone: "0912345678", address: "20 Điện Biên Phủ", province: "Đà Nẵng", ward: "Phường Thanh Khê" },
    item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10, note: "Gọi trước khi giao" },
    ...(cod && { cod }),
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const order = await Order.findByIdAndUpdate(
    created.body.data._id,
    {
      $set: { status: "AT_DEST_HUB", currentHubId: created.body.data.destHubId },
      $push: { statusHistory: { status: "AT_DEST_HUB", at: new Date(), note: "Nhận tại kho đích" } },
    },
    { new: true },
  ).lean();
  return order;
}

/** Don dang giao cua tai xe A (da phan cong + quet ma mang di). */
async function outForDelivery(name, options) {
  const order = await atDestHub(name, options);
  const res = await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.a._id, reason: "Giao cho tài xế A để kiểm thử" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const started = await as("a", request(app).post(`/deliveries/${order._id}/start`)).send({ code: order.trackingCode, ...GPS });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  return Order.findById(order._id).lean();
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  service = getContainer().deliveryService;
  const hn = await Hub.findOne({ code: "HUB-HN" }).lean();
  routes = Object.fromEntries((await Route.find({}).lean()).map((r) => [r.code, r]));
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  express = await ServiceType.findOne({ code: "EXPRESS" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const shipper = (i, fullName, routeCode, extra = {}) => ({
    email: EMAILS[i],
    phone: `090998350${i}`,
    passwordHash,
    fullName,
    role: "SHIPPER",
    routeIds: [routes[routeCode]._id],
    ...extra,
  });
  const [, , , a, b, hcm, back] = await User.create([
    { email: EMAILS[0], phone: "0909983500", passwordHash, fullName: "Kho HN Giao hàng", role: "HUB_STAFF", hubId: hn._id },
    { email: EMAILS[1], phone: "0909983501", passwordHash, fullName: "Chủ Shop GH", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Giao Hàng" },
    { email: EMAILS[2], phone: "0909983502", passwordHash, fullName: "Shop Khác", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    shipper(3, "Tài xế GH A", "R-DN-NOI", { maxDeliveryPerShift: 2 }),
    shipper(4, "Tài xế GH B", "R-DN-NOI", { maxDeliveryPerShift: 1 }),
    shipper(5, "Tài xế GH HCM", "R-HCM-NOI"),
    shipper(6, "Tài xế GH Hoàn", "R-HN-NOI"),
    { email: EMAILS[7], phone: "0909983507", passwordHash, fullName: "Admin GH", role: "ADMIN" },
  ]);
  tx = { a, b, hcm, back };
  const login = async (email) => (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = {
    kho: await login(EMAILS[0]),
    shop: await login(EMAILS[1]),
    other: await login(EMAILS[2]),
    a: await login(EMAILS[3]),
    b: await login(EMAILS[4]),
    hcm: await login(EMAILS[5]),
    back: await login(EMAILS[6]),
    admin: await login(EMAILS[7]),
  };
  const addLocation = async (body) => (await as("shop", request(app).post("/pickupLocations")).send({ contactName: "Chủ Shop GH", contactPhone: "0909983501", ...body })).body.data;
  hnLocation = await addLocation({ label: "Kho HN", address: "1 Hàng Bài", province: "Hà Nội", ward: "Phường Hoàn Kiếm" });
  dnLocation = await addLocation({ label: "Kho ĐN", address: "10 Bạch Đằng", province: "Đà Nẵng", ward: "Phường Hải Châu" });
  assert.ok(hnLocation?._id && dnLocation?._id, "tao duoc dia diem lay hang");
});

beforeEach(async () => {
  // Moi test: ca giao ca ngay R-DN-NOI gom A (2 don), B (1 don); ca hoan R-HN-NOI gom tai xe hoan; chua co don
  const ids = Object.values(tx).map((u) => u._id);
  await Assignment.deleteMany({ shipperId: { $in: ids } });
  await Order.deleteMany({ customerId: { $in: (await User.find({ email: { $in: EMAILS.slice(1, 3) } }).lean()).map((u) => u._id) } });
  await Shift.deleteMany({ name: /^KT35 / });
  await Setting.deleteOne({ _id: "delivery" });
  const day = vnNow(new Date()).day.replaceAll("-", "");
  await Shift.create([
    { code: `KT35-${day}-DN`, name: "KT35 Ca giao", startTime: "00:00", endTime: "23:59", routeId: routes["R-DN-NOI"]._id, shiftDate: today(), shipperIds: [tx.a._id, tx.b._id] },
    { code: `KT35-${day}-HN`, name: "KT35 Ca hoàn", startTime: "00:00", endTime: "23:59", routeId: routes["R-HN-NOI"]._id, shiftDate: today(), shipperIds: [tx.back._id] },
  ]);
});

after(async () => {
  try {
    await worker?.close();
    await cleanup();
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

// ---------------------------------------------------------------- US-35 phan cong giao

test("[US-35] tu dong phan cong don giao khi toi kho dich: nguoi it don nhat, khong vuot nang luc giao; het cho -> hang cho co ly do", async () => {
  const orders = [];
  for (const name of ["E2E GH Một", "E2E GH Hai", "E2E GH Ba", "E2E GH Bốn"]) orders.push(await atDestHub(name));
  const results = [];
  for (const o of orders) results.push(await service.autoAssign(o._id));
  assert.deepEqual(results.map((r) => r.status), ["ASSIGNED", "ASSIGNED", "ASSIGNED", "UNASSIGNED"]);
  // A nang luc 2, B nang luc 1 -> A 2 don, B 1 don, don thu tu cho
  const byShipper = results.slice(0, 3).map((r) => r.shipper.fullName).sort();
  assert.deepEqual(byShipper, ["Tài xế GH A", "Tài xế GH A", "Tài xế GH B"]);
  assert.match(results[3].reason, /R-DN-NOI: người trực ca đã đủ năng lực giao/);
  const first = await Order.findById(orders[0]._id).lean();
  assert.equal(first.status, "DELIVERY_ASSIGNED");
  assert.equal(first.statusHistory.at(-1).status, "DELIVERY_ASSIGNED");
  assert.equal(await Assignment.countDocuments({ orderId: orders[0]._id, type: "DELIVERY", method: "AUTO" }), 1);
  // Chay lai (BullMQ thu lai su kien) khong gan trung
  assert.equal((await service.autoAssign(orders[0]._id)).status, "SKIPPED");
  const waiting = await Order.findById(orders[3]._id).lean();
  assert.equal(waiting.status, "AT_DEST_HUB");
  assert.match(waiting.unassignedReason, /đủ năng lực giao/);
});

test("[US-35] don gui nhanh giao rieng, duoc phan cong truoc don gui thuong (de 14)", async () => {
  const normal = [];
  for (const name of ["E2E GH Thường 1", "E2E GH Thường 2"]) normal.push(await atDestHub(name));
  const fast = await atDestHub("E2E GH Nhanh", { from: "DN", serviceType: express });
  // Chiem truoc 2 cho: chi con 1 cho (B) -> chay hang cho thi don nhanh (tao sau cung) duoc gan truoc
  await as("kho", request(app).post("/deliveries/assign")).send({ orderId: normal[0]._id, shipperId: tx.a._id, reason: "Giữ chỗ để kiểm thử" });
  await as("kho", request(app).post("/deliveries/assign")).send({ orderId: normal[1]._id, shipperId: tx.a._id, reason: "Giữ chỗ để kiểm thử" });
  const extra = await atDestHub("E2E GH Thường 3");
  const run = await as("kho", request(app).post("/deliveries/auto"));
  assert.equal(run.status, 200, JSON.stringify(run.body));
  assert.equal((await Order.findById(fast._id).lean()).status, "DELIVERY_ASSIGNED");
  assert.equal((await Order.findById(extra._id).lean()).status, "AT_DEST_HUB", "het cho thi don thuong o lai");
  const board = await as("kho", request(app).get("/deliveries/board"));
  assert.equal(board.status, 200);
  assert.ok(board.body.data.queue.some((o) => o.trackingCode === extra.trackingCode && o.kind === "DELIVERY"));
  assert.ok(board.body.data.assigned.some((o) => o.trackingCode === fast.trackingCode && o.express === true));
});

test("[US-35] dieu chinh tay: bat buoc ly do, nguoi phai phu trach tuyen giao; phan cong cu bi huy", async () => {
  const order = await atDestHub("E2E GH Điều chỉnh");
  await service.autoAssign(order._id);
  const noReason = await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.b._id, reason: "" });
  assert.equal(noReason.status, 400);
  const wrongRoute = await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.hcm._id, reason: "Thử người tuyến khác" });
  assert.equal(wrongRoute.status, 400);
  assert.match(wrongRoute.body.error.message, /không phụ trách tuyến R-DN-NOI/);
  const current = (await Order.findById(order._id).lean()).assignedTo;
  const other = String(current) === String(tx.a._id) ? tx.b : tx.a;
  const moved = await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: other._id, reason: "Tài xế cũ nghỉ ốm" });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.data.kind, "DELIVERY");
  assert.equal(await Assignment.countDocuments({ orderId: order._id, type: "DELIVERY", status: "CANCELLED" }), 1);
  assert.equal(await Assignment.countDocuments({ orderId: order._id, type: "DELIVERY", status: "ASSIGNED", method: "MANUAL", reason: "Tài xế cũ nghỉ ốm" }), 1);
  // Nguoi ngoai pham vi (tai xe) khong xem / dieu chinh duoc bang phan cong
  assert.equal((await as("a", request(app).get("/deliveries/board"))).status, 403);
});

// ---------------------------------------------------------------- US-31 danh sach + phieu giao

test("[US-31] danh sach don can giao cua nguoi giao hang trong ca: nguoi nhan, dia chi, so tien phai thu; nguoi khac khong thay", async () => {
  const order = await atDestHub("E2E GH Danh sách", { cod: { enabled: true, amount: 250000, feePayer: "RECIPIENT_PAID" } });
  await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.a._id, reason: "Giao cho A kiểm thử" });
  const mine = await as("a", request(app).get("/deliveries/mine"));
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  const item = mine.body.data.orders.find((o) => o.trackingCode === order.trackingCode);
  assert.ok(item, "tai xe A thay don");
  assert.equal(item.type, "DELIVERY");
  assert.deepEqual(item.to, { name: "E2E GH Danh sách", phone: "0912345678", address: "20 Điện Biên Phủ, Phường Thanh Khê, Đà Nẵng" });
  assert.deepEqual(item.collect, { cod: 250000, fee: order.fee.total, total: 250000 + order.fee.total });
  assert.equal(item.item.note, "Gọi trước khi giao");
  assert.equal(mine.body.data.counts.toDeliver, 1);
  assert.equal(mine.body.data.counts.toCollect, 250000 + order.fee.total);
  const other = await as("b", request(app).get("/deliveries/mine"));
  assert.ok(!other.body.data.orders.some((o) => o.trackingCode === order.trackingCode));
  assert.equal((await as("kho", request(app).get("/deliveries/mine"))).status, 403);
});

test("[US-31] phieu giao hang in duoc (dia chi, phuong/xa, so dien thoai) co ma QR chua ma van don (PB#18, de 14)", async () => {
  const order = await atDestHub("E2E GH Phiếu", { cod: { enabled: true, amount: 100000, feePayer: "SHOP_PREPAID", feePaymentMethod: "CASH" } });
  await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.a._id, reason: "Giao cho A kiểm thử" });
  const slip = await as("a", request(app).get(`/deliveries/${order._id}/slip`));
  assert.equal(slip.status, 200, JSON.stringify(slip.body));
  const data = slip.body.data;
  assert.equal(data.trackingCode, order.trackingCode);
  assert.match(data.qr, /^data:image\/png;base64,/);
  assert.deepEqual(
    [data.receiver.name, data.receiver.phone, data.receiver.address, data.receiver.ward, data.receiver.province],
    ["E2E GH Phiếu", "0912345678", "20 Điện Biên Phủ", "Phường Thanh Khê", "Đà Nẵng"],
  );
  // Shop tra truoc phi -> chi thu tien hang
  assert.deepEqual(data.collect, { cod: 100000, fee: 0, total: 100000 });
  // Kho trong pham vi xem/in duoc; tai xe khac khong
  assert.equal((await as("kho", request(app).get(`/deliveries/${order._id}/slip`))).status, 200);
  assert.equal((await as("b", request(app).get(`/deliveries/${order._id}/slip`))).status, 404);
});

// ---------------------------------------------------------------- US-32 giao hang, US-33 thu COD

test("[US-32] quet sai ma bi chan; giao thanh cong ghi GPS, chuyen DELIVERED, khong doi trang thai duoc nua", async () => {
  // Shop tra truoc phi, khong thu ho -> giao khong can thu tien (thu tien kiem o US-33)
  const order = await atDestHub("E2E GH Thành công", { cod: { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "QR" } });
  await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.a._id, reason: "Giao cho A kiểm thử" });
  const wrong = await as("a", request(app).post(`/deliveries/${order._id}/start`)).send({ code: "EXP0000000000", ...GPS });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error.message, /không khớp/);
  assert.equal((await as("b", request(app).post(`/deliveries/${order._id}/start`)).send({ code: order.trackingCode, ...GPS })).status, 404);
  const started = await as("a", request(app).post(`/deliveries/${order._id}/start`)).send({ code: order.trackingCode.toLowerCase(), ...GPS });
  assert.equal(started.body.data.status, "OUT_FOR_DELIVERY");

  const noGps = await as("a", request(app).post(`/deliveries/${order._id}/delivered`)).send({});
  assert.equal(noGps.status, 400);
  const done = await as("a", request(app).post(`/deliveries/${order._id}/delivered`)).send(GPS);
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.data.status, "DELIVERED");
  const saved = await Order.findById(order._id).lean();
  assert.deepEqual(saved.statusHistory.at(-1).location, GPS);
  const assignment = await Assignment.findOne({ orderId: order._id, type: "DELIVERY", status: "DONE" }).lean();
  assert.deepEqual(assignment.location, GPS);
  // DELIVERED la trang thai cuoi
  for (const path of ["delivered", "failed", "start"]) {
    const again = await as("a", request(app).post(`/deliveries/${order._id}/${path}`)).send({ code: order.trackingCode, reason: "REFUSED", ...GPS });
    assert.equal(again.status, 409, path);
  }
  assert.equal((await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.b._id, reason: "Thử đổi sau khi giao" })).status, 409);
});

test("[US-33] thu COD tien mat hoac chuyen khoan, cung transaction voi DELIVERED: phai thu dung so tien, phi nguoi nhan tra ghi da thu", async () => {
  const cod = { enabled: true, amount: 300000, feePayer: "RECIPIENT_PAID" };
  const order = await outForDelivery("E2E GH COD", { cod });
  const expected = amountToCollect(order).total;
  assert.equal(expected, 300000 + order.fee.total);

  const short = await as("a", request(app).post(`/deliveries/${order._id}/delivered`)).send({ ...GPS, collectedAmount: 300000, method: "CASH" });
  assert.equal(short.status, 400);
  assert.match(short.body.error.message, /Phải thu đủ/);
  const noRef = await as("a", request(app).post(`/deliveries/${order._id}/delivered`)).send({ ...GPS, collectedAmount: expected, method: "TRANSFER" });
  assert.equal(noRef.status, 400);
  assert.equal((await Order.findById(order._id).lean()).status, "OUT_FOR_DELIVERY", "loi thi khong doi gi");

  const ok = await as("a", request(app).post(`/deliveries/${order._id}/delivered`)).send({ ...GPS, collectedAmount: expected, method: "TRANSFER", txnRef: "FT2611120001" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.status, "DELIVERED");
  assert.equal(saved.cod.collected, true);
  assert.equal(saved.cod.method, "TRANSFER");
  assert.equal(saved.cod.txnRef, "FT2611120001");
  assert.ok(saved.cod.collectedAt);
  assert.equal(saved.cod.feePaid, true, "phi nguoi nhan tra -> da thu cung luc");
  assert.match(saved.statusHistory.at(-1).note, /đã thu .* \(Chuyển khoản · mã GD FT2611120001\)/);

  // Shop tra truoc, khong thu ho -> khong phai thu gi
  const prepaid = await outForDelivery("E2E GH Không thu", { cod: { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "QR" } });
  const none = await as("a", request(app).post(`/deliveries/${prepaid._id}/delivered`)).send(GPS);
  assert.equal(none.status, 200, JSON.stringify(none.body));
  assert.equal(none.body.data.collected, null);
});

test("[US-32] giao that bai: bat buoc chon nguyen nhan (Ly do khac phai ghi chu), tang so lan giao, ghi nguyen nhan (PB#40)", async () => {
  const order = await outForDelivery("E2E GH Thất bại");
  assert.equal((await as("a", request(app).post(`/deliveries/${order._id}/failed`)).send(GPS)).status, 400);
  const other = await as("a", request(app).post(`/deliveries/${order._id}/failed`)).send({ reason: "OTHER", note: "", ...GPS });
  assert.equal(other.status, 400);
  const res = await as("a", request(app).post(`/deliveries/${order._id}/failed`)).send({ reason: "RECIPIENT_UNREACHABLE", note: "Gọi 3 lần", ...GPS });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.data.status, res.body.data.attempts, res.body.data.maxAttempts], ["RESCHEDULED", 1, 3]);
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.deliveryAttempts, 1);
  assert.equal(saved.assignedTo, null);
  const [failed, next] = saved.statusHistory.slice(-2);
  assert.equal(failed.status, "DELIVERY_FAILED");
  assert.match(failed.note, /Giao không thành công lần 1: Không liên hệ được người nhận — Gọi 3 lần/);
  assert.deepEqual(failed.location, GPS);
  assert.equal(next.status, "RESCHEDULED");
  const assignment = await Assignment.findOne({ orderId: order._id, type: "DELIVERY", status: "FAILED" }).lean();
  assert.deepEqual([assignment.failReason, assignment.failNote], ["RECIPIENT_UNREACHABLE", "Gọi 3 lần"]);
  const reasons = await as("a", request(app).get("/deliveries/fail-reasons"));
  assert.ok(reasons.body.data.some((r) => r.value === "REFUSED" && r.label === "Người nhận từ chối nhận hàng"));
});

// ---------------------------------------------------------------- US-36 giao lai

test("[US-36] chinh sach giao lai: mac dinh toi da 3 lan, vuot qua thi don chuyen RETURNING; tu choi nhan thi hoan ngay; admin doi so lan", () => {
  assert.deepEqual(afterFailedDelivery({ reason: "RECIPIENT_ABSENT", attempts: 1 }).next, "RESCHEDULED");
  assert.deepEqual(afterFailedDelivery({ reason: "RECIPIENT_ABSENT", attempts: 2 }).next, "RESCHEDULED");
  assert.deepEqual(afterFailedDelivery({ reason: "RECIPIENT_ABSENT", attempts: 3 }), { next: "RETURNING", why: "Đã giao không thành công 3/3 lần" });
  assert.deepEqual(afterFailedDelivery({ reason: "REFUSED", attempts: 1 }), { next: "RETURNING", why: "Người nhận từ chối nhận hàng" });
  assert.equal(afterFailedDelivery({ reason: "WRONG_ADDRESS", attempts: 2, maxAttempts: 2 }).next, "RETURNING");
});

test("[US-36] giao lai: don cho giao lai tu vao lai hang cho phan cong; that bai lan thu 3 -> hoan hang; admin doi chinh sach con 2 lan", async () => {
  const order = await outForDelivery("E2E GH Giao lại");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await as("a", request(app).post(`/deliveries/${order._id}/failed`)).send({ reason: "RECIPIENT_ABSENT", ...GPS });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    if (attempt < 3) {
      assert.equal(res.body.data.status, "RESCHEDULED");
      // Consumer su kien se goi autoAssign; o day goi truc tiep -> phan cong lai, mang di giao tiep
      const again = await service.autoAssign(order._id);
      assert.equal(again.status, "ASSIGNED", JSON.stringify(again));
      await as("kho", request(app).post("/deliveries/assign")).send({ orderId: order._id, shipperId: tx.a._id, reason: "Giao lại cho tài xế A" });
      await as("a", request(app).post(`/deliveries/${order._id}/start`)).send({ code: order.trackingCode, ...GPS });
    } else {
      assert.equal(res.body.data.status, "RETURNING");
    }
  }
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.deliveryAttempts, 3);
  assert.equal(saved.returnReason, "Đã giao không thành công 3/3 lần");

  // Admin doi chinh sach: 2 lan; nhan vien kho khong doi duoc
  assert.equal((await as("kho", request(app).put("/deliveries/policy")).send({ maxDeliveryAttempts: 2 })).status, 403);
  assert.equal((await as("admin", request(app).put("/deliveries/policy")).send({ maxDeliveryAttempts: 0 })).status, 400);
  const set = await as("admin", request(app).put("/deliveries/policy")).send({ maxDeliveryAttempts: 2 });
  assert.deepEqual(set.body.data, { maxDeliveryAttempts: 2 });
  const second = await outForDelivery("E2E GH Hai lần");
  await as("a", request(app).post(`/deliveries/${second._id}/failed`)).send({ reason: "RECIPIENT_ABSENT", ...GPS });
  await service.autoAssign(second._id);
  await as("kho", request(app).post("/deliveries/assign")).send({ orderId: second._id, shipperId: tx.a._id, reason: "Giao lại cho tài xế A" });
  await as("a", request(app).post(`/deliveries/${second._id}/start`)).send({ code: second.trackingCode, ...GPS });
  const last = await as("a", request(app).post(`/deliveries/${second._id}/failed`)).send({ reason: "RECIPIENT_ABSENT", ...GPS });
  assert.deepEqual([last.body.data.status, last.body.data.attempts, last.body.data.maxAttempts], ["RETURNING", 2, 2]);
});

// ---------------------------------------------------------------- US-37 hoan hang

test("[US-37] hoan hang: phan cong theo tuyen lay hang cu (Assignment RETURN), tai xe tra hang, ket thuc RETURNED khi shop xac nhan", async () => {
  const order = await outForDelivery("E2E GH Hoàn");
  const refused = await as("a", request(app).post(`/deliveries/${order._id}/failed`)).send({ reason: "REFUSED", ...GPS });
  assert.equal(refused.body.data.status, "RETURNING");
  // Shop chua nhan duoc hang -> chua xac nhan duoc
  assert.equal((await as("shop", request(app).post(`/deliveries/${order._id}/confirm-return`))).status, 409);

  const assigned = await service.autoAssign(order._id, "RETURN");
  assert.equal(assigned.status, "ASSIGNED", JSON.stringify(assigned));
  assert.equal(assigned.shipper.fullName, "Tài xế GH Hoàn", "tuyen R-HN-NOI cua dia diem lay hang o Ha Noi");
  assert.equal(await Assignment.countDocuments({ orderId: order._id, type: "RETURN", status: "ASSIGNED" }), 1);
  const mine = await as("back", request(app).get("/deliveries/mine"));
  const item = mine.body.data.orders.find((o) => o.trackingCode === order.trackingCode);
  assert.equal(item.type, "RETURN");
  assert.deepEqual(item.to, { name: "Chủ Shop GH", phone: "0909983501", address: "1 Hàng Bài, Phường Hoàn Kiếm, Hà Nội" });
  assert.equal(item.collect.total, 0);
  assert.equal(item.returnReason, "Người nhận từ chối nhận hàng");

  const handed = await as("back", request(app).post(`/deliveries/${order._id}/handed-back`)).send({ lat: 21.0285, lng: 105.8542 });
  assert.equal(handed.status, 200, JSON.stringify(handed.body));
  assert.equal(handed.body.data.status, "RETURNING", "cho shop xac nhan");
  const board = await as("kho", request(app).get("/deliveries/board"));
  assert.ok(board.body.data.awaitingShop.some((o) => o.trackingCode === order.trackingCode));

  assert.equal((await as("other", request(app).post(`/deliveries/${order._id}/confirm-return`))).status, 404);
  const confirmed = await as("shop", request(app).post(`/deliveries/${order._id}/confirm-return`));
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.data.status, "RETURNED");
  const saved = await Order.findById(order._id).lean();
  assert.deepEqual(saved.statusHistory.slice(-3).map((h) => h.status), ["RETURNING", "RETURNING", "RETURNED"]);
  assert.equal(await Assignment.countDocuments({ orderId: order._id, type: "RETURN", status: "DONE" }), 1);
});

// ---------------------------------------------------------------- luong nghiep vu

test("[US-35][US-31][US-32][US-33] luong nghiep vu: don toi kho dich -> consumer tu phan cong giao -> tai xe xem danh sach, phieu QR -> quet ma, thu COD -> nguoi nhan tra cuu thay Da giao", async () => {
  worker = getContainer().startOrderEventWorker();
  const order = await atDestHub("E2E GH Luồng", { cod: { enabled: true, amount: 150000, feePayer: "DEDUCT_FROM_COD" } });
  // Kho dich nhan hang -> su kien order.status.changed (AT_DEST_HUB) -> consumer phan cong giao
  await getContainer().orderEvents.publish("order.status.changed", {
    orderId: String(order._id),
    trackingCode: order.trackingCode,
    from: "IN_TRANSIT",
    to: "AT_DEST_HUB",
    by: null,
    at: new Date().toISOString(),
  });
  let assigned = null;
  for (let i = 0; i < 100 && assigned?.status !== "DELIVERY_ASSIGNED"; i += 1) {
    assigned = await Order.findById(order._id).lean();
    if (assigned.status !== "DELIVERY_ASSIGNED") await wait(50);
  }
  assert.equal(assigned.status, "DELIVERY_ASSIGNED", "consumer phan cong giao");
  const who = String(assigned.assignedTo) === String(tx.a._id) ? "a" : "b";

  const list = await as(who, request(app).get("/deliveries/mine"));
  const item = list.body.data.orders.find((o) => o.trackingCode === order.trackingCode);
  // Khau tru phi vao thu ho -> nguoi nhan chi tra dung tien hang
  assert.deepEqual(item.collect, { cod: 150000, fee: 0, total: 150000 });
  const slip = await as(who, request(app).get(`/deliveries/${order._id}/slip`));
  assert.match(slip.body.data.qr, /^data:image\/png/);

  await as(who, request(app).post(`/deliveries/${order._id}/start`)).send({ code: order.trackingCode, ...GPS });
  const done = await as(who, request(app).post(`/deliveries/${order._id}/delivered`)).send({ ...GPS, collectedAmount: 150000, method: "CASH" });
  assert.equal(done.status, 200, JSON.stringify(done.body));

  let journey = null;
  for (let i = 0; i < 100 && journey?.status !== "DELIVERED"; i += 1) {
    journey = JSON.parse((await getRedis().get(`journey:${order.trackingCode}`)) || "null");
    if (journey?.status !== "DELIVERED") await wait(50);
  }
  const limits = await getRedis().keys("ratelimit:tracking:*");
  if (limits.length) await getRedis().del(...limits);
  const tracked = await request(app).get(`/tracking/${order.trackingCode}`);
  assert.equal(tracked.status, 200, JSON.stringify(tracked.body));
  assert.equal(tracked.body.data.groupLabel, "Đã giao");
  assert.ok(tracked.body.data.events.some((e) => e.status === "OUT_FOR_DELIVERY"));
});
