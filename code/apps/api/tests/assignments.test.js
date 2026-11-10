// US-25 phan cong lay hang (tu dong theo tuyen + nang luc, chong vuot nang luc khi dong thoi, hang cho,
// dieu chinh tay co ly do) va US-27 danh sach don can lay cua nguoi giao hang theo ca hien tai.
// Tuyen R-DN-NOI (buu cuc PO-DN truc thuoc HUB-HN): khach rieng lay hang o Hai Chau - Da Nang; ca thu
// nghiem "KT25 ..." ca ngay hom nay chi gom nguoi giao hang rieng cua file nay.
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
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = [
  "pc-kho-hn@edms.vn",
  "pc-kho-hcm@edms.vn",
  "pc-khach@edms.vn",
  "pc-tx-a@edms.vn",
  "pc-tx-b@edms.vn",
  "pc-tx-c@edms.vn",
  "pc-tx-hcm@edms.vn",
];

let app;
let service;
let token = {};
let routes;
let standard;
let location;
let tx = {};
let shift;

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("_id").lean();
  await Assignment.deleteMany({ $or: [{ orderId: { $in: orders.map((o) => o._id) } }, { shipperId: { $in: ids } }] });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await Shift.deleteMany({ name: /^KT25 / });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const today = () => parseShiftDate(vnNow(new Date()).day);

/** Khach tao don lay hang o Da Nang, kho HN (hub cap tren cua PO-DN) xac nhan -> CONFIRMED. */
async function confirmedOrder(name) {
  const created = await as("khach", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
    item: { name: "Áo thun", weightGram: 500, length: 20, width: 15, height: 5 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const confirmed = await as("hn", request(app).post(`/orders/${created.body.data._id}/confirm`));
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  return confirmed.body.data;
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  service = getContainer().assignmentService;
  const hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "HUB-HCM"] } }).lean()).map((h) => [h.code, h]));
  routes = Object.fromEntries((await Route.find({}).lean()).map((r) => [r.code, r]));
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const shipper = (i, fullName, routeCode, extra = {}) => ({
    email: EMAILS[i],
    phone: `090998260${i}`,
    passwordHash,
    fullName,
    role: "SHIPPER",
    routeIds: [routes[routeCode]._id],
    ...extra,
  });
  const [, , , a, b, c, hcm] = await User.create([
    { email: EMAILS[0], phone: "0909982600", passwordHash, fullName: "Kho HN Phân công", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[1], phone: "0909982601", passwordHash, fullName: "Kho HCM Phân công", role: "HUB_STAFF", hubId: hubs["HUB-HCM"]._id },
    { email: EMAILS[2], phone: "0909982602", passwordHash, fullName: "Shop Phân công", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    shipper(3, "Tài xế PC A", "R-DN-NOI", { maxPickupPerShift: 2 }),
    shipper(4, "Tài xế PC B", "R-DN-NOI", { maxPickupPerShift: 3 }),
    shipper(5, "Tài xế PC C", "R-DN-NOI"),
    shipper(6, "Tài xế PC HCM", "R-HCM-NOI"),
  ]);
  tx = { a, b, c, hcm };
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = {
    hn: await login(EMAILS[0]),
    hcm: await login(EMAILS[1]),
    khach: await login(EMAILS[2]),
    a: await login(EMAILS[3]),
    c: await login(EMAILS[5]),
  };
  location = (
    await as("khach", request(app).post("/pickupLocations")).send({
      label: "Kho Đà Nẵng", contactName: "Chủ shop", contactPhone: "0909982602", address: "10 Bạch Đằng",
      province: "Đà Nẵng", district: "Hải Châu", ward: "Thạch Thang",
    })
  ).body.data;
  assert.ok(location?._id, "tao duoc dia diem lay hang o Da Nang");
});

beforeEach(async () => {
  // Moi test bat dau tu: mot ca ca ngay gom A, B (C khong trong ca) va khong co phan cong / don nao
  const ids = Object.values(tx).map((u) => u._id);
  await Assignment.deleteMany({ shipperId: { $in: ids } });
  await Order.deleteMany({ customerId: (await User.findOne({ email: EMAILS[2] }).lean())._id });
  await Shift.deleteMany({ name: /^KT25 / });
  const day = vnNow(new Date()).day.replaceAll("-", "");
  [shift] = await Shift.create([
    { code: `KT25-${day}-A`, name: "KT25 Ca ngày", startTime: "00:00", endTime: "23:59", routeId: routes["R-DN-NOI"]._id, shiftDate: today(), shipperIds: [tx.a._id, tx.b._id] },
    // Ca da ket thuc (00:00-00:01) -> khong duoc chon
    { code: `KT25-${day}-B`, name: "KT25 Ca đã qua", startTime: "00:00", endTime: "00:01", routeId: routes["R-DN-NOI"]._id, shiftDate: today(), shipperIds: [tx.c._id] },
  ]);
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

test("[US-25] tu dong phan cong khi don CONFIRMED: chon nguoi trong ca it don nhat, chua day nang luc", async () => {
  const first = await confirmedOrder("E2E PC một");
  // Consumer cua su kien: chi phan ung voi CONFIRMED
  assert.equal(service.onOrderStatusChanged({ to: "CREATED", orderId: first._id }), null);
  const r1 = await getContainer().orderEventHandlers["order.status.changed"]({ to: "CONFIRMED", orderId: first._id, trackingCode: first.trackingCode });
  assert.equal(r1, undefined, "handler chay journey + phan cong, khong tra ve");
  let saved = await Order.findById(first._id).lean();
  assert.equal(saved.status, "PICKUP_ASSIGNED");
  assert.equal(String(saved.assignedTo), String(tx.a._id), "hoa nhau 0 don -> theo ten: A");
  assert.match(saved.statusHistory.at(-1).note, /Phân công tự động: Tài xế PC A \(KT25 Ca ngày 00:00–23:59\)/);
  const assignment = await Assignment.findOne({ orderId: first._id }).lean();
  assert.equal(assignment.method, "AUTO");
  assert.equal(String(assignment.shiftId), String(shift._id));

  // Chay lai (BullMQ thu lai job) -> khong phan cong lan hai
  assert.equal((await service.autoAssignPickup(first._id)).status, "SKIPPED");
  assert.equal(await Assignment.countDocuments({ orderId: first._id }), 1);

  // Don thu hai -> B (A dang co 1 don chua lay); C khong trong ca con mo, khong bao gio duoc chon
  const second = await confirmedOrder("E2E PC hai");
  const r2 = await service.autoAssignPickup(second._id);
  assert.equal(r2.status, "ASSIGNED");
  assert.equal(r2.shipper.fullName, "Tài xế PC B");
  assert.deepEqual([r2.load, r2.capacity], [1, 3]);
  saved = await Order.findById(second._id).lean();
  assert.equal(String(saved.assignedTo), String(tx.b._id));
});

test("[US-25] 10 don phan cong DONG THOI khong vuot nang luc (A 2 + B 3); con lai vao hang cho kem ly do", async () => {
  const orders = [];
  for (let i = 0; i < 10; i += 1) orders.push(await confirmedOrder(`E2E PC đồng thời ${i}`));
  const results = await Promise.all(orders.map((o) => service.autoAssignPickup(o._id)));
  assert.equal(results.filter((r) => r.status === "ASSIGNED").length, 5);
  assert.equal(results.filter((r) => r.status === "UNASSIGNED").length, 5);
  assert.equal(await Assignment.countDocuments({ shiftId: shift._id, shipperId: tx.a._id, status: "ASSIGNED" }), 2);
  assert.equal(await Assignment.countDocuments({ shiftId: shift._id, shipperId: tx.b._id, status: "ASSIGNED" }), 3);
  const queued = await Order.find({ _id: { $in: orders.map((o) => o._id) }, status: "CONFIRMED" }).lean();
  assert.equal(queued.length, 5);
  for (const o of queued) {
    assert.equal(o.assignedTo, null);
    assert.equal(o.unassignedReason, "Tuyến R-DN-NOI: người trực ca đã đủ năng lực");
  }
  // Moi don duoc gan dung mot lan
  assert.equal(await Assignment.countDocuments({ orderId: { $in: orders.map((o) => o._id) } }), 5);
});

test("[US-25] khong co ca con mo tren tuyen -> hang cho; them ca roi chay lai hang cho thi duoc phan cong", async () => {
  await Shift.deleteOne({ _id: shift._id });
  const order = await confirmedOrder("E2E PC chờ ca");
  const queued = await service.autoAssignPickup(order._id);
  assert.deepEqual(queued, { status: "UNASSIGNED", trackingCode: order.trackingCode, reason: "Tuyến R-DN-NOI chưa có người trực ca còn lại hôm nay" });

  const board = await as("hn", request(app).get("/assignments/pickup")).expect(200);
  const row = board.body.data.queue.find((o) => o.trackingCode === order.trackingCode);
  assert.equal(row.route.code, "R-DN-NOI");
  assert.match(row.unassignedReason, /chưa có người trực ca/);

  const copy = shift.toObject();
  delete copy._id;
  await Shift.create({ ...copy, code: `${shift.code}-2` });
  const rerun = await as("hn", request(app).post("/assignments/pickup/auto")).expect(200);
  assert.ok(rerun.body.data.assigned >= 1, JSON.stringify(rerun.body.data));
  assert.equal((await Order.findById(order._id).lean()).status, "PICKUP_ASSIGNED");
});

test("[US-25] dieu chinh tay: bat buoc ly do, nguoi phai phu trach tuyen, pham vi hub; huy phan cong cu, cho phep vuot nang luc co canh bao", async () => {
  const order = await confirmedOrder("E2E PC điều chỉnh");
  await service.autoAssignPickup(order._id); // -> A
  const body = { orderId: order._id, shipperId: tx.b._id };
  await as("hn", request(app).post("/assignments/pickup")).send(body).expect(400);
  await as("hn", request(app).post("/assignments/pickup")).send({ ...body, reason: "ốm" }).expect(400);
  await as("hn", request(app).post("/assignments/pickup")).send({ ...body, shipperId: tx.hcm._id, reason: "Đổi người lấy" }).expect(400);
  await as("hn", request(app).post("/assignments/pickup")).send({ ...body, shipperId: tx.a._id, reason: "Đổi người lấy" }).expect(409);
  await as("hcm", request(app).post("/assignments/pickup")).send({ ...body, reason: "Đổi người lấy" }).expect(404);
  await as("a", request(app).post("/assignments/pickup")).send({ ...body, reason: "Đổi người lấy" }).expect(403);

  // A nghi dot xuat -> chuyen cho B
  const moved = await as("hn", request(app).post("/assignments/pickup")).send({ ...body, reason: "Tài xế A nghỉ ốm" }).expect(201);
  assert.equal(moved.body.data.shipper.fullName, "Tài xế PC B");
  assert.equal(moved.body.data.overCapacity, false);
  const all = await Assignment.find({ orderId: order._id }).sort({ assignedAt: 1 }).lean();
  assert.deepEqual(all.map((a) => [a.method, a.status]), [["AUTO", "CANCELLED"], ["MANUAL", "ASSIGNED"]]);
  assert.equal(all[1].reason, "Tài xế A nghỉ ốm");
  const saved = await Order.findById(order._id).lean();
  assert.equal(String(saved.assignedTo), String(tx.b._id));
  assert.match(saved.statusHistory.at(-1).note, /lý do: Tài xế A nghỉ ốm/);

  // Don uu tien: B da day (3) van giao them cho B -> duoc, kem canh bao vuot nang luc
  for (let i = 0; i < 2; i += 1) {
    const extra = await confirmedOrder(`E2E PC đầy ${i}`);
    await as("hn", request(app).post("/assignments/pickup")).send({ orderId: extra._id, shipperId: tx.b._id, reason: "Khách VIP cần lấy sớm" }).expect(201);
  }
  const urgent = await confirmedOrder("E2E PC ưu tiên");
  const over = await as("hn", request(app).post("/assignments/pickup")).send({ orderId: urgent._id, shipperId: tx.b._id, reason: "Đơn ưu tiên, B tiện đường" }).expect(201);
  assert.equal(over.body.data.overCapacity, true);
  assert.deepEqual([over.body.data.load, over.body.data.capacity], [4, 3]);

  // C khong co ca hom nay -> phan cong ngoai ca (khong tinh vao ca nao)
  const outside = await as("hn", request(app).post("/assignments/pickup")).send({ orderId: urgent._id, shipperId: tx.c._id, reason: "C trực bù ngoài ca" }).expect(201);
  assert.equal(outside.body.data.shift, null);
});

test("[US-25] bang phan cong: kho thay tai tung nguoi theo ca, don da phan cong; kho HCM khong thay don Da Nang", async () => {
  const one = await confirmedOrder("E2E PC bảng");
  await service.autoAssignPickup(one._id);
  const res = await as("hn", request(app).get("/assignments/pickup")).expect(200);
  const day = res.body.data.shifts.find((s) => String(s._id) === String(shift._id));
  const a = day.shippers.find((s) => s.fullName === "Tài xế PC A");
  assert.deepEqual([a.used, a.pending, a.capacity], [1, 1, 2]);
  const b = day.shippers.find((s) => s.fullName === "Tài xế PC B");
  assert.deepEqual([b.used, b.capacity], [0, 3]);
  const row = res.body.data.assigned.find((o) => o.trackingCode === one.trackingCode);
  assert.equal(row.assignedTo.fullName, "Tài xế PC A");
  const options = res.body.data.shippersByRoute.find((r) => r.code === "R-DN-NOI");
  assert.ok(options.shippers.some((s) => s.fullName === "Tài xế PC C"));

  const hcm = await as("hcm", request(app).get("/assignments/pickup")).expect(200);
  assert.ok(!hcm.body.data.assigned.some((o) => o.trackingCode === one.trackingCode));
  assert.ok(!hcm.body.data.shifts.some((s) => String(s._id) === String(shift._id)));
  await as("khach", request(app).get("/assignments/pickup")).expect(403);
});

test("[US-27] nguoi giao hang xem don can lay trong ca hien tai: dia chi lay, lien he, so dem; nguoi khac khong thay", async () => {
  const orders = [await confirmedOrder("E2E PC lấy 1"), await confirmedOrder("E2E PC lấy 2"), await confirmedOrder("E2E PC lấy 3")];
  for (const o of orders) await service.autoAssignPickup(o._id); // A, B, A
  const res = await as("a", request(app).get("/assignments/mine/pickups")).expect(200);
  const data = res.body.data;
  assert.equal(String(data.currentShiftId), String(shift._id));
  assert.equal(data.counts.total, 2);
  assert.equal(data.counts.toPick, 2);
  assert.deepEqual(data.orders.map((o) => o.trackingCode), [orders[0].trackingCode, orders[2].trackingCode]);
  assert.deepEqual(data.orders[0].pickup, { contactName: "Chủ shop", contactPhone: "0909982602", address: "10 Bạch Đằng, Thạch Thang, Hải Châu, Đà Nẵng" });
  assert.equal(data.orders[0].item.name, "Áo thun");

  // C co ca da ket thuc va khong co don -> danh sach rong, khong co ca hien tai
  const c = (await as("c", request(app).get("/assignments/mine/pickups")).expect(200)).body.data;
  assert.equal(c.currentShiftId, null);
  assert.equal(c.counts.total, 0);
  assert.equal(c.shifts.length, 1, "van thay ca da qua trong ngay");
  await as("hn", request(app).get("/assignments/mine/pickups")).expect(403);
});

test("[US-25] luong nghiep vu: shop tao don -> kho duyet -> phan cong tu dong -> kho dieu chinh co ly do -> tai xe moi thay don can lay", async () => {
  // 1-2. Shop tao don, kho duyet -> CONFIRMED (su kien order.status.changed)
  const order = await confirmedOrder("E2E PC luồng");
  // 3. Consumer phan cong tu dong -> A
  await getContainer().orderEventHandlers["order.status.changed"]({ to: "CONFIRMED", orderId: order._id, trackingCode: order.trackingCode });
  let a = (await as("a", request(app).get("/assignments/mine/pickups")).expect(200)).body.data;
  assert.deepEqual(a.orders.map((o) => o.trackingCode), [order.trackingCode]);
  // Khach thay don "Da phan cong lay hang" (nhom Chua nhan)
  const mine = await as("khach", request(app).get(`/orders/${order._id}`)).expect(200);
  assert.equal(mine.body.data.status, "PICKUP_ASSIGNED");
  assert.equal(mine.body.data.display.statusLabel, "Đã phân công lấy hàng");

  // 4. A bao ban -> kho chuyen cho B, ghi ly do
  await as("hn", request(app).post("/assignments/pickup")).send({ orderId: order._id, shipperId: tx.b._id, reason: "A quá tải đơn giao" }).expect(201);
  // 5. A khong con thay don; B thay don can lay
  a = (await as("a", request(app).get("/assignments/mine/pickups")).expect(200)).body.data;
  assert.equal(a.counts.total, 0);
  const bToken = (await request(app).post("/auth/login").send({ emailOrPhone: EMAILS[4], password: PASSWORD })).body.data.accessToken;
  const b = (await request(app).get("/assignments/mine/pickups").set("Authorization", `Bearer ${bToken}`).expect(200)).body.data;
  assert.deepEqual(b.orders.map((o) => [o.trackingCode, o.method]), [[order.trackingCode, "MANUAL"]]);
  // Hanh trinh co nhan cua don ghi ca hai moc phan cong
  const history = (await Order.findById(order._id).lean()).statusHistory.map((h) => h.status);
  assert.deepEqual(history, ["CREATED", "CONFIRMED", "PICKUP_ASSIGNED", "PICKUP_ASSIGNED"]);
});
