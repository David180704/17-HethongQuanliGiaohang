// US-39 (de 02): thong ke bang aggregation pipeline - so don theo moc / trang thai, theo shop, khu vuc, kho,
// nang suat nguoi giao hang, doanh thu phi, thu ho, doi soat; quan tri vien toan he thong, kho theo pham vi.
// So lieu seed thay doi theo ngay -> kiem bang do chenh truoc / sau khi them du lieu cua file nay (ky = hom nay).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order, Assignment } from "../src/models/index.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["tk-shop@edms.vn", "tk-admin@edms.vn", "tk-kho-hn@edms.vn", "tk-kho-dn@edms.vn", "tk-tx@edms.vn"];
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const PERIOD = { from: today, to: today };

let app;
let token = {};
let users = {};

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("_id trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Assignment.deleteMany({ $or: [{ orderId: { $in: orders.map((o) => o._id) } }, { shipperId: { $in: ids } }] });
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const overview = async (who) => {
  const res = await as(who, request(app).get("/stats/overview")).query(PERIOD);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
};

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hubs = Object.fromEntries((await Hub.find({ code: { $in: ["HUB-HN", "PO-DN"] } }).lean()).map((h) => [h.code, h]));
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [shop, , , , tx] = await User.create([
    { email: EMAILS[0], phone: "0909983901", passwordHash, fullName: "Shop Thống Kê", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Thống Kê" },
    { email: EMAILS[1], phone: "0909983902", passwordHash, fullName: "Admin Thống kê", role: "ADMIN" },
    { email: EMAILS[2], phone: "0909983903", passwordHash, fullName: "Kho HN Thống kê", role: "HUB_STAFF", hubId: hubs["HUB-HN"]._id },
    { email: EMAILS[3], phone: "0909983904", passwordHash, fullName: "Kho ĐN Thống kê", role: "HUB_STAFF", hubId: hubs["PO-DN"]._id },
    { email: EMAILS[4], phone: "0909983905", passwordHash, fullName: "Tài xế Thống kê", role: "SHIPPER", routeIds: [] },
  ]);
  users = { shop, tx };
  const login = async (email) => (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { shop: await login(EMAILS[0]), admin: await login(EMAILS[1]), hn: await login(EMAILS[2]), dn: await login(EMAILS[3]), tx: await login(EMAILS[4]) };
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

test("[US-39] chi quan tri vien va nhan vien kho xem thong ke; ngay sai bi 400", async () => {
  assert.equal((await as("shop", request(app).get("/stats/overview"))).status, 403);
  assert.equal((await as("tx", request(app).get("/stats/overview"))).status, 403);
  assert.equal((await as("admin", request(app).get("/stats/overview")).query({ from: "12/11/2026" })).status, 400);
  const data = await overview("admin");
  for (const key of ["created", "pickedUp", "inTransit", "waitingDelivery", "delivered", "deliveryFailed", "returned"]) {
    assert.equal(typeof data.orders[key], "number", key);
  }
  assert.ok(Array.isArray(data.byShop) && Array.isArray(data.byArea) && Array.isArray(data.byHub) && Array.isArray(data.shippers));
  assert.ok(data.settlements, "quan tri vien thay doi soat");
  assert.equal((await overview("hn")).settlements, null, "kho khong thay doi soat");
});

test("[US-39] thong ke don theo trang thai, shop, khu vuc, kho, nang suat nhan vien, doanh thu, thu ho bang aggregation pipeline", async () => {
  const before = { admin: await overview("admin"), hn: await overview("hn"), dn: await overview("dn") };
  const location = (
    await as("shop", request(app).post("/pickupLocations")).send({
      label: "Kho", contactName: "Shop", contactPhone: "0909983901", address: "1 Hàng Bài", province: "Hà Nội", ward: "Phường Hoàn Kiếm",
    })
  ).body.data;
  const standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const create = async (name) =>
    (
      await as("shop", request(app).post("/orders")).send({
        pickupLocationId: location._id,
        serviceTypeId: standard._id,
        receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
        item: { name: "Áo", weightGram: 500, length: 20, width: 15, height: 5 },
        cod: { enabled: true, amount: 300000, feePayer: "RECIPIENT_PAID" },
      })
    ).body.data;
  const delivered = await create("E2E TK Giao");
  const failed = await create("E2E TK Hụt");
  const now = new Date();
  await Order.updateOne(
    { _id: delivered._id },
    {
      $set: { status: "DELIVERED", "fee.lockedAt": now, "cod.collected": true, "cod.collectedAt": now, "cod.method": "TRANSFER" },
      $push: { statusHistory: { $each: [{ status: "PICKED_UP", at: now }, { status: "DELIVERED", at: now }] } },
    },
  );
  await Order.updateOne({ _id: failed._id }, { $set: { status: "RESCHEDULED" }, $push: { statusHistory: { $each: [{ status: "DELIVERY_FAILED", at: now }, { status: "RESCHEDULED", at: now }] } } });
  await Assignment.create([
    { orderId: delivered._id, shipperId: users.tx._id, type: "DELIVERY", shiftDate: now, method: "AUTO", status: "DONE", doneAt: now },
    { orderId: failed._id, shipperId: users.tx._id, type: "DELIVERY", shiftDate: now, method: "AUTO", status: "FAILED", doneAt: now, failReason: "RECIPIENT_ABSENT" },
  ]);

  const after = await overview("admin");
  const diff = (key) => after.orders[key] - before.admin.orders[key];
  assert.deepEqual(
    ["created", "pickedUp", "delivered", "deliveryFailed", "waitingDelivery"].map((k) => [k, diff(k)]),
    [["created", 2], ["pickedUp", 1], ["delivered", 1], ["deliveryFailed", 1], ["waitingDelivery", 1]],
  );
  assert.equal(after.revenue.fee - before.admin.revenue.fee, delivered.fee.total, "doanh thu: don khoa phi trong ky");
  assert.equal(after.cod.collected - before.admin.cod.collected, 300000);
  assert.equal(after.cod.transfer - before.admin.cod.transfer, 300000);
  const shopRow = after.byShop.find((s) => s.customerName === "Shop Thống Kê");
  assert.deepEqual([shopRow.orders, shopRow.delivered], [2, 1]);
  const area = (data) => data.byArea.find((a) => a.province === "TP Hồ Chí Minh")?.orders || 0;
  assert.equal(area(after) - area(before.admin), 2, "theo khu vuc giao");
  const hub = (data) => data.byHub.find((h) => h.code === "HUB-HN")?.orders || 0;
  assert.equal(hub(after) - hub(before.admin), 2, "theo kho nhan");
  const me = after.shippers.find((s) => s.fullName === "Tài xế Thống kê");
  assert.deepEqual([me.deliveries, me.failed, me.pickups], [1, 1, 0], "nang suat nguoi giao hang");

  // Pham vi kho: don lay o Ha Noi giao TP HCM -> kho HN thay, buu cuc Da Nang khong thay
  assert.equal((await overview("hn")).orders.created - before.hn.orders.created, 2);
  assert.equal((await overview("dn")).orders.created - before.dn.orders.created, 0);
});
