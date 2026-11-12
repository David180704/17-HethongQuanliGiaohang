// US-38 (de 02): su co, khieu nai - noi dung, don lien quan, tinh trang xu ly, ket qua giai quyet. Don chua
// ket thuc chuyen INCIDENT (dung giao nhan) toi khi giai quyet het; don da ket thuc giu nguyen trang thai.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order, Incident } from "../src/models/index.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["sc-shop@edms.vn", "sc-shop-khac@edms.vn", "sc-kho-hn@edms.vn", "sc-kho-dn@edms.vn", "sc-admin@edms.vn"];

let app;
let token = {};
let standard;
let location;

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("_id trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Incident.deleteMany({ orderId: { $in: orders.map((o) => o._id) } });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);

/** Don cua shop da duoc kho HN xac nhan (CONFIRMED). */
async function confirmedOrder(name) {
  const created = await as("shop", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
    item: { name: "Bộ cốc thủy tinh", weightGram: 1200, length: 30, width: 20, height: 15, declaredValue: 400000 },
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
  const hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "PO-DN"] } }).lean()).map((h) => [h.code, h]));
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909983801", passwordHash, fullName: "Shop Sự Cố", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Sự Cố" },
    { email: EMAILS[1], phone: "0909983802", passwordHash, fullName: "Shop Khác", role: "CUSTOMER", customerType: "INDIVIDUAL" },
    { email: EMAILS[2], phone: "0909983803", passwordHash, fullName: "Kho HN Sự cố", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[3], phone: "0909983804", passwordHash, fullName: "Kho ĐN Sự cố", role: "HUB_STAFF", hubId: hubs["PO-DN"]._id },
    { email: EMAILS[4], phone: "0909983805", passwordHash, fullName: "Admin Sự cố", role: "ADMIN" },
  ]);
  const login = async (email) => (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { shop: await login(EMAILS[0]), other: await login(EMAILS[1]), hn: await login(EMAILS[2]), dn: await login(EMAILS[3]), admin: await login(EMAILS[4]) };
  location = (
    await as("shop", request(app).post("/pickupLocations")).send({
      label: "Kho shop", contactName: "Shop Sự Cố", contactPhone: "0909983801", address: "1 Hàng Bài", province: "Hà Nội", ward: "Phường Hoàn Kiếm",
    })
  ).body.data;
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

test("[US-38] shop bao su co tren don cua minh: ma SC tang, don chuyen INCIDENT; du lieu sai, don cua nguoi khac bi chan", async () => {
  const order = await confirmedOrder("E2E SC Một");
  assert.equal((await as("shop", request(app).post("/incidents")).send({ orderId: order._id, type: "BROKEN", description: "Hàng bị vỡ khi nhận" })).status, 400);
  assert.equal((await as("shop", request(app).post("/incidents")).send({ orderId: order._id, type: "DAMAGED", description: "vỡ" })).status, 400);
  assert.equal((await as("other", request(app).post("/incidents")).send({ orderId: order._id, type: "DAMAGED", description: "Không phải đơn của tôi" })).status, 404);

  const res = await as("shop", request(app).post("/incidents")).send({ trackingCode: order.trackingCode.toLowerCase(), type: "WRONG_INFO", description: "Ghi sai số điện thoại người nhận, cần sửa" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const incident = res.body.data;
  assert.match(incident.code, /^SC\d{6}$/);
  assert.deepEqual([incident.status, incident.statusLabel, incident.source, incident.typeLabel], ["OPEN", "Mới ghi nhận", "SHOP", "Sai thông tin giao nhận"]);
  assert.equal(incident.orderStatusBefore, "CONFIRMED");
  const saved = await Order.findById(order._id).lean();
  assert.equal(saved.status, "INCIDENT");
  assert.match(saved.statusHistory.at(-1).note, new RegExp(`Sự cố ${incident.code}: Sai thông tin giao nhận`));
  // Ma sau lon hon ma truoc (bo dem tang trong transaction)
  const next = await as("shop", request(app).post("/incidents")).send({ orderId: order._id, type: "OTHER", description: "Muốn đổi giờ lấy hàng sang chiều" });
  assert.ok(next.body.data.code > incident.code);
  // Shop chi thay su co cua minh
  assert.equal((await as("other", request(app).get("/incidents"))).body.meta.total, 0);
  assert.equal((await as("shop", request(app).get("/incidents")).query({ orderId: order._id })).body.meta.total, 2);
});

test("[US-38] kho ngoai pham vi khong thay; kho cua don ghi tien do va giai quyet; giai quyet het thi don tra lai trang thai cu", async () => {
  const order = await confirmedOrder("E2E SC Hai");
  const first = (await as("shop", request(app).post("/incidents")).send({ orderId: order._id, type: "SHOP_COMPLAINT", description: "Shipper hẹn lấy hàng nhưng không đến" })).body.data;
  const second = (await as("hn", request(app).post("/incidents")).send({ orderId: order._id, type: "OTHER", description: "Khách yêu cầu kiểm tra lại cân nặng", source: "SHOP" })).body.data;
  assert.equal(second.source, "SHOP", "nhan vien ghi ho shop");

  // Buu cuc Da Nang khong lien quan don (lay o Ha Noi, giao TP HCM)
  assert.equal((await as("dn", request(app).get(`/incidents/${first._id}`))).status, 404);
  assert.equal((await as("shop", request(app).post(`/incidents/${first._id}/progress`)).send({ note: "Tôi tự xử lý" })).status, 403);
  assert.equal((await as("hn", request(app).post(`/incidents/${first._id}/progress`)).send({ note: "" })).status, 400);
  const progress = await as("hn", request(app).post(`/incidents/${first._id}/progress`)).send({ note: "Đã gọi shop, hẹn lấy lại 15h" });
  assert.equal(progress.body.data.status, "IN_PROGRESS");

  assert.equal((await as("hn", request(app).post(`/incidents/${first._id}/resolve`)).send({ result: "xong" })).status, 400);
  assert.equal((await as("hn", request(app).post(`/incidents/${first._id}/resolve`)).send({ result: "Đã lấy hàng lại đúng hẹn", compensation: -5 })).status, 400);
  const resolved = await as("hn", request(app).post(`/incidents/${first._id}/resolve`)).send({ result: "Đã điều shipper khác lấy hàng đúng hẹn" });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.deepEqual(resolved.body.data.history.map((h) => h.status), ["OPEN", "IN_PROGRESS", "RESOLVED"]);
  assert.equal((await Order.findById(order._id).lean()).status, "INCIDENT", "con su co thu hai dang mo");

  await as("admin", request(app).post(`/incidents/${second._id}/resolve`)).send({ result: "Cân lại đúng 1,2 kg, giữ nguyên phí" });
  const restored = await Order.findById(order._id).lean();
  assert.equal(restored.status, "CONFIRMED");
  assert.match(restored.statusHistory.at(-1).note, new RegExp(`Đã giải quyết sự cố ${second.code}`));
  assert.equal((await as("hn", request(app).post(`/incidents/${second._id}/resolve`)).send({ result: "Giải quyết lần hai" })).status, 409);
});

test("[US-38] don dang INCIDENT bi dung giao nhan; don da giao van ghi khieu nai nhung giu trang thai Da giao", async () => {
  const order = await confirmedOrder("E2E SC Ba");
  await as("shop", request(app).post("/incidents")).send({ orderId: order._id, type: "LOST", description: "Shop báo thiếu một kiện khi bàn giao" });
  const blocked = await as("hn", request(app).post("/assignments/pickup")).send({ orderId: order._id, shipperId: new mongoose.Types.ObjectId(), reason: "Thử phân công khi có sự cố" });
  assert.equal(blocked.status, 409, "dang su co thi khong phan cong lay hang");

  const delivered = await confirmedOrder("E2E SC Đã giao");
  await Order.updateOne({ _id: delivered._id }, { $set: { status: "DELIVERED" }, $push: { statusHistory: { status: "DELIVERED", at: new Date() } } });
  const complaint = await as("hn", request(app).post("/incidents")).send({
    trackingCode: delivered.trackingCode,
    type: "RECIPIENT_COMPLAINT",
    source: "RECIPIENT",
    description: "Người nhận gọi tổng đài: hộp bị móp, hàng bên trong còn nguyên",
  });
  assert.equal(complaint.status, 201, JSON.stringify(complaint.body));
  assert.deepEqual([complaint.body.data.source, complaint.body.data.orderStatusBefore], ["RECIPIENT", null]);
  assert.equal((await Order.findById(delivered._id).lean()).status, "DELIVERED");
});

test("[US-38] luong nghiep vu: shop bao hu hong -> kho xu ly, giai quyet co boi thuong -> shop xem ket qua, don chay tiep", async () => {
  const order = await confirmedOrder("E2E SC Luồng");
  const reported = await as("shop", request(app).post("/incidents")).send({ orderId: order._id, type: "DAMAGED", description: "Ảnh shop chụp: kiện bị ướt khi bàn giao" });
  assert.equal(reported.status, 201);
  const id = reported.body.data._id;
  // Kho thay trong danh sach su co dang mo cua kho minh
  const open = await as("hn", request(app).get("/incidents")).query({ status: "OPEN", search: reported.body.data.code });
  assert.equal(open.body.meta.total, 1);
  await as("hn", request(app).post(`/incidents/${id}/progress`)).send({ note: "Đã kiểm tra kiện, hàng bên trong ẩm nhẹ" });
  const done = await as("hn", request(app).post(`/incidents/${id}/resolve`)).send({ result: "Đóng gói lại, tiếp tục giao; bồi thường một phần", compensation: 50000 });
  assert.equal(done.body.data.resolution.compensation, 50000);
  const mine = await as("shop", request(app).get(`/incidents/${id}`));
  assert.deepEqual([mine.body.data.status, mine.body.data.resolution.result], ["RESOLVED", "Đóng gói lại, tiếp tục giao; bồi thường một phần"]);
  assert.match(mine.body.data.history.at(-1).note, /bồi thường 50\.000 đ/);
  assert.equal((await Order.findById(order._id).lean()).status, "CONFIRMED");
  const types = await as("shop", request(app).get("/incidents/types"));
  assert.ok(types.body.data.some((t) => t.value === "DAMAGED" && t.label === "Hư hỏng hàng hóa"));
});
