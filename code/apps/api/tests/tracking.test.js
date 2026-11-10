// US-22: tra cuu hanh trinh cong khai bang ma van don - khong can dang nhap, 4 nhom trang thai cua de 14,
// che so dien thoai, khong lo ten / dia chi; gioi han 20 lan/phut moi IP. Doc hanh trinh do hang doi su
// kien (US-21) ghi; moi test xoa bo dem gioi han truoc vi request test deu tu cung mot IP.
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order } from "../src/models/index.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["trk-khach@edms.vn", "trk-kho-hn@edms.vn"];

let app;
let token = {};
let location;
let standard;
let worker;

async function cleanup() {
  const ids = (await User.find({ email: { $in: EMAILS } }).select("_id").lean()).map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
}

async function resetRateLimit() {
  const keys = await getRedis().keys("ratelimit:tracking:*");
  if (keys.length) await getRedis().del(...keys);
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const track = (code) => request(app).get(`/tracking/${code}`);
const createOrder = async (receiverName) => {
  const res = await as("khach", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver: { name: receiverName, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
    item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10 },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
};

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  app = createApp();
  const hn = await Hub.findOne({ code: "HUB-HN" }).lean();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909982201", passwordHash, fullName: "Shop Tra Cứu", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Tra Cứu" },
    { email: EMAILS[1], phone: "0909982202", passwordHash, fullName: "Kho HN Tra Cứu", role: "HUB_STAFF", hubId: hn._id },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { khach: await login(EMAILS[0]), kho: await login(EMAILS[1]) };
  location = (
    await as("khach", request(app).post("/pickupLocations")).send({
      label: "Kho shop", contactName: "Shop Tra Cứu", contactPhone: "0909982201", address: "1 Xuân Thủy",
      province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
    })
  ).body.data;
});

beforeEach(resetRateLimit);

after(async () => {
  try {
    await worker?.close();
    await resetRateLimit();
    await cleanup();
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-22] tra cuu cong khai khong can dang nhap: nhom trang thai de 14, moc co nhan, che so, khong lo ten va dia chi", async () => {
  const order = await createOrder("Trần Người Nhận");
  const res = await track(order.trackingCode);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data;
  assert.equal(data.trackingCode, order.trackingCode);
  assert.equal(data.groupLabel, "Chưa nhận");
  assert.equal(data.statusLabel, "Chờ bưu cục xác nhận");
  assert.deepEqual(data.events.map((e) => e.label), ["Chờ bưu cục xác nhận"]);
  assert.deepEqual(data.receiver, { phone: "09xx xxx 678", district: "Quận 1", province: "TP Hồ Chí Minh" });
  assert.equal(data.sender.name, "Shop Tra Cứu");
  const text = JSON.stringify(res.body);
  for (const secret of ["Trần Người Nhận", "0912345678", "Lý Tự Trọng", "Bến Nghé", "customerId", "fee"]) {
    assert.ok(!text.includes(secret), `khong duoc lo "${secret}"`);
  }
});

test("[US-22] ma sai dinh dang -> 400; ma khong ton tai -> 404; go chu thuong van tra duoc", async () => {
  const order = await createOrder("Nhận chữ thường");
  for (const bad of ["ABC", "EXP123", "EXP12345678901"]) {
    const res = await track(bad);
    assert.equal(res.status, 400, bad);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  const missing = await track("EXP9999999999");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, "NOT_FOUND");
  assert.equal((await track(order.trackingCode.toLowerCase())).status, 200);
});

test("[US-22] gioi han 20 lan/phut moi IP: dem ca ma sai, lan 21 -> 429 kem Retry-After", async () => {
  const first = await track("EXP9999999999");
  assert.equal(first.headers["x-ratelimit-limit"], "20");
  assert.equal(first.headers["x-ratelimit-remaining"], "19");
  for (let i = 2; i <= 20; i += 1) assert.notEqual((await track("EXP9999999999")).status, 429, `lan ${i}`);
  const blocked = await track("EXP9999999999");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, "TOO_MANY_REQUESTS");
  const retry = Number(blocked.headers["retry-after"]);
  assert.ok(retry > 0 && retry <= 60, `Retry-After = ${retry}`);
  assert.equal(blocked.headers["x-ratelimit-remaining"], "0");
});

test("[US-22] luong nghiep vu: khach tao don -> nguoi nhan tra cuu thay Chua nhan; kho duyet -> hang doi cap nhat 2 moc", async () => {
  worker = getContainer().startOrderEventWorker();
  const order = await createOrder("Nhận luồng US-22");
  assert.equal((await track(order.trackingCode)).body.data.events.length, 1);

  assert.equal((await as("kho", request(app).post(`/orders/${order._id}/confirm`))).status, 200);
  let data;
  for (let i = 0; i < 100; i += 1) {
    data = (await track(order.trackingCode)).body.data;
    if (data.events.length === 2) break;
    await wait(50);
    if (i % 15 === 14) await resetRateLimit(); // vong cho khong duoc tu dung het han muc 20 lan/phut
  }
  assert.deepEqual(data.events.map((e) => e.label), ["Chờ bưu cục xác nhận", "Đã xác nhận, chờ lấy hàng"]);
  assert.equal(data.groupLabel, "Chưa nhận");
  assert.equal(data.statusLabel, "Đã xác nhận, chờ lấy hàng");
});
