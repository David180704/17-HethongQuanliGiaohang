// US-40: tiep nhan hang tai quay (luong chinh de 14). Nhan vien kho tim khach theo so dien thoai (khong co thi
// tao khach le), kiem hang, bao gia tu diem cua minh kem goi y phuong tien, tao don: phi khoa ngay, don di
// CREATED -> CONFIRMED -> AT_HUB trong mot transaction; ma don cua shop tim kiem duoc.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers, suspendAreas } from "./helpers/fixtures.js";
// Xa/phuong co that tam ngung phuc vu trong luc test -> dung lam dia chi "ngoai vung phuc vu"
const OUTSIDE = [{ province: "Cà Mau", ward: "Xã Năm Căn" }];
let restoreAreas;

import { User, Hub, ServiceType, Order, PickupLocation } from "../src/models/index.js";
import { suggestVehicle } from "../src/modules/orders/vehicle.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["ctr-kho-hn@edms.vn", "ctr-shop@edms.vn", "ctr-kho-khong-diem@edms.vn"];
const WALK_IN_PHONES = ["0909982311", "0909982312"];

let app;
let token = {};
let hub;
let standard;
let express;
let worker;

async function cleanup() {
  const users = await User.find({ $or: [{ email: { $in: EMAILS } }, { phone: { $in: WALK_IN_PHONES } }] }).select("_id").lean();
  const ids = users.map((u) => u._id);
  const orders = await Order.find({ customerId: { $in: ids } }).select("trackingCode").lean();
  if (orders.length) await getRedis().del(...orders.map((o) => `journey:${o.trackingCode}`));
  await Order.deleteMany({ customerId: { $in: ids } });
  await PickupLocation.deleteMany({ customerId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  // Khach le dang nhap sai co chu y -> chay test lien tiep de bi khoa (5 lan / 15 phut); xoa dem khoa
  await getRedis().del(...WALK_IN_PHONES.flatMap((p) => [`login:fail:${p}`, `login:lock:${p}`]));
}

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const receiver = { name: "Lê Người Nhận", phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" };
const counterBody = (overrides = {}) => ({
  customer: { phone: "0909982302" },
  serviceTypeId: standard._id,
  receiver,
  item: { name: "Áo thun", weightGram: 1200, length: 30, width: 20, height: 10, declaredValue: 300000 },
  shopOrderCode: "SHOPEE-240001",
  ...overrides,
});

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await cleanup();
  restoreAreas = await suspendAreas(OUTSIDE);
  app = createApp();
  hub = await Hub.findOne({ code: "HUB-HN" }).lean();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  express = await ServiceType.findOne({ code: "EXPRESS" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909982301", passwordHash, fullName: "Kho HN Quầy", role: "HUB_STAFF", hubId: hub._id },
    { email: EMAILS[1], phone: "0909982302", passwordHash, fullName: "Chủ Shop Quầy", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Quầy" },
    { email: EMAILS[2], phone: "0909982303", passwordHash, fullName: "Kho chưa gán điểm", role: "HUB_STAFF" },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { kho: await login(EMAILS[0]), shop: await login(EMAILS[1]), khongDiem: await login(EMAILS[2]) };
});

after(async () => {
  try {
    await worker?.close();
    await cleanup();
    await restoreAreas?.();
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-40] goi y phuong tien: hang la xe, tren 30 kg tinh phi, canh tren 100 cm -> xe tai; con lai xe may", () => {
  assert.equal(suggestVehicle({ chargeableWeight: 800, item: { length: 20, width: 10, height: 10 } }).code, "MOTORBIKE");
  assert.equal(suggestVehicle({ chargeableWeight: 800, flags: { isVehicle: true } }).reason, "Hàng là xe");
  assert.equal(suggestVehicle({ chargeableWeight: 30_001, item: {} }).code, "TRUCK");
  assert.equal(suggestVehicle({ chargeableWeight: 30_000, item: { length: 100 } }).code, "MOTORBIKE", "dung nguong van xe may");
  assert.equal(suggestVehicle({ chargeableWeight: 5000, item: { length: 101, width: 20, height: 20 } }).reason, "Cạnh dài nhất trên 100 cm");
});

test("[US-40] tim khach theo so dien thoai: co tai khoan, chua co, so cua nhan vien; khach hang khong goi duoc", async () => {
  const found = await as("kho", request(app).get("/orders/counter/customers?phone=0909 982 302"));
  assert.equal(found.status, 200);
  assert.equal(found.body.data.found, true);
  assert.equal(found.body.data.customer.shopName, "Shop Quầy");
  assert.equal(found.body.data.customer.passwordHash, undefined);

  const missing = await as("kho", request(app).get(`/orders/counter/customers?phone=${WALK_IN_PHONES[0]}`));
  assert.deepEqual(missing.body.data, { found: false, phone: WALK_IN_PHONES[0] });

  const staffPhone = await as("kho", request(app).get("/orders/counter/customers?phone=0909982301"));
  assert.equal(staffPhone.status, 400);
  assert.equal((await as("kho", request(app).get("/orders/counter/customers?phone=123"))).status, 400);
  assert.equal((await as("shop", request(app).get("/orders/counter/customers?phone=0909982302"))).status, 403);
  assert.equal((await as("khongDiem", request(app).get("/orders/counter/customers?phone=0909982302"))).status, 403);
});

test("[US-40] bao gia tai quay: noi gui la diem cua nhan vien, kem goi y phuong tien", async () => {
  const small = await as("kho", request(app).post("/orders/counter/quote")).send({
    receiver: { province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
    item: { weightGram: 1200, length: 30, width: 20, height: 10 },
  });
  assert.equal(small.status, 200, JSON.stringify(small.body));
  assert.equal(small.body.data.pickupArea.ward, hub.ward);
  assert.equal(small.body.data.counter.hubName, hub.name);
  assert.equal(small.body.data.vehicle.code, "MOTORBIKE");
  assert.ok(small.body.data.options.length >= 2, "bao gia moi loai dich vu");
  // Cau truc App Nhan vien dung de chon dich vu (da gap loi doc nham o.serviceType._id)
  for (const option of small.body.data.options) {
    assert.ok(option.serviceTypeId && option.name, JSON.stringify(option));
    // Ha Noi -> TP HCM: giao nhanh khong ap dung (chi trong cung tinh), van liet ke kem ly do
    if (option.code === "EXPRESS") assert.deepEqual([option.available, option.fee], [false, null]);
    else assert.ok(option.available && option.fee.total > 0, JSON.stringify(option));
  }

  const bike = await as("kho", request(app).post("/orders/counter/quote")).send({
    receiver: { province: "Hà Nội", ward: "Phường Cầu Giấy" },
    item: { weightGram: 90000, length: 180, width: 60, height: 110 },
    flags: { isVehicle: true },
  });
  assert.equal(bike.status, 200, JSON.stringify(bike.body));
  assert.deepEqual(bike.body.data.vehicle, { code: "TRUCK", label: "Xe tải", reason: "Hàng là xe" });
});

test("[US-40] tao don tai quay cho khach co tai khoan: AT_HUB, 3 moc, phi khoa, ma don cua shop tim duoc", async () => {
  const res = await as("kho", request(app).post("/orders/counter")).send(counterBody());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const order = res.body.data;
  assert.equal(order.channel, "COUNTER");
  assert.equal(order.status, "AT_HUB");
  assert.deepEqual(order.statusHistory.map((h) => h.status), ["CREATED", "CONFIRMED", "AT_HUB"]);
  assert.ok(order.fee.lockedAt, "phi khoa ngay khi tiep nhan");
  assert.equal(order.customerName, "Shop Quầy");
  assert.equal(String(order.pickupHubId), String(hub._id));
  assert.equal(order.pickupLocationId, null);
  assert.equal(order.vehicle, "MOTORBIKE");
  assert.equal(order.newCustomer, false);
  assert.equal(order.display.groupLabel, "Đã nhận – Chưa giao");
  assert.match(order.statusHistory[0].note, /Tiếp nhận tại quầy/);

  // Shop thay don trong danh sach cua minh; tim theo ma don cua shop
  const mine = await as("shop", request(app).get("/orders?search=SHOPEE-240001"));
  assert.deepEqual(mine.body.data.map((o) => o.trackingCode), [order.trackingCode]);
  // Nhan vien kho cung diem thay don
  assert.equal((await as("kho", request(app).get(`/orders/${order._id}`))).status, 200);
});

test("[US-40] khach chua co tai khoan -> tao khach le (chua dang nhap duoc); thieu ho ten -> 400; tra tien mat tai quay -> da thu phi", async () => {
  const noName = await as("kho", request(app).post("/orders/counter")).send(counterBody({ customer: { phone: WALK_IN_PHONES[0] } }));
  assert.equal(noName.status, 400);
  assert.match(noName.body.error.message, /nhập họ tên/);
  assert.equal(await User.countDocuments({ phone: WALK_IN_PHONES[0] }), 0, "khong tao khach khi loi");

  const res = await as("kho", request(app).post("/orders/counter")).send(
    counterBody({
      customer: { phone: WALK_IN_PHONES[0], fullName: "Nguyễn Khách Lẻ" },
      // Giao nhanh chi trong cung tinh: quay Ha Noi gui noi thanh Ha Noi
      receiver: { ...receiver, province: "Hà Nội", ward: "Phường Cầu Giấy" },
      serviceTypeId: express._id,
      shopOrderCode: "",
      cod: { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "CASH" },
    }),
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.newCustomer, true);
  assert.equal(res.body.data.customerName, "Nguyễn Khách Lẻ");
  assert.equal(res.body.data.cod.feePaid, true);
  assert.ok(res.body.data.cod.feePaidAt);
  assert.equal(res.body.data.shopOrderCode, null);

  const walkIn = await User.findOne({ phone: WALK_IN_PHONES[0] }).lean();
  assert.equal(walkIn.walkIn, true);
  assert.equal(walkIn.email, `${WALK_IN_PHONES[0]}@khachle.edms.vn`);
  const login = await request(app).post("/auth/login").send({ emailOrPhone: WALK_IN_PHONES[0], password: PASSWORD });
  assert.equal(login.status, 401, "khach le chua dat mat khau nen chua dang nhap duoc");

  // Lan sau khach quay lai: tim thay, khong tao trung
  const again = await as("kho", request(app).post("/orders/counter")).send(counterBody({ customer: { phone: WALK_IN_PHONES[0] } }));
  assert.equal(again.status, 201);
  assert.equal(again.body.data.newCustomer, false);
  assert.equal(await User.countDocuments({ phone: WALK_IN_PHONES[0] }), 1);
});

test("[US-40] rang buoc: ngoai vung phuc vu, khau tru thu ho nho hon phi, nhan vien chua gan diem", async () => {
  const outside = await as("kho", request(app).post("/orders/counter")).send(
    counterBody({ receiver: { ...receiver, province: "Cà Mau", ward: "Xã Năm Căn" } }),
  );
  assert.equal(outside.status, 422);
  assert.equal(outside.body.error.code, "OUT_OF_SERVICE_AREA");
  const cod = await as("kho", request(app).post("/orders/counter")).send(
    counterBody({ cod: { enabled: true, amount: 1000, feePayer: "DEDUCT_FROM_COD" } }),
  );
  assert.equal(cod.status, 422);
  assert.equal(cod.body.error.code, "COD_LESS_THAN_FEE");
  assert.equal((await as("khongDiem", request(app).post("/orders/counter")).send(counterBody())).status, 403);
});

test("[US-40] don truc tuyen cung nhan ma don cua shop", async () => {
  const location = (
    await as("shop", request(app).post("/pickupLocations")).send({
      label: "Kho shop", contactName: "Chủ Shop", contactPhone: "0909982302", address: "1 Xuân Thủy",
      province: "Hà Nội", ward: "Phường Cầu Giấy",
    })
  ).body.data;
  const res = await as("shop", request(app).post("/orders")).send({
    pickupLocationId: location._id,
    serviceTypeId: standard._id,
    receiver,
    item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10 },
    shopOrderCode: "  LAZ-778899  ",
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.data.shopOrderCode, "LAZ-778899");
  assert.equal(res.body.data.channel, "ONLINE");
  const tooLong = await as("shop", request(app).post("/orders")).send({ ...res.body.data, pickupLocationId: location._id, shopOrderCode: "x".repeat(51) });
  assert.equal(tooLong.status, 400);
});

test("[US-40] luong nghiep vu: tiep nhan tai quay -> hang doi cap nhat -> nguoi nhan tra cuu thay Da nhan - Chua giao, 3 moc", async () => {
  worker = getContainer().startOrderEventWorker();
  const res = await as("kho", request(app).post("/orders/counter")).send(
    counterBody({ customer: { phone: WALK_IN_PHONES[1], fullName: "Khách Lẻ Luồng" } }),
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const code = res.body.data.trackingCode;

  // Nhan vien kho thay don trong danh sach cua diem, loc trang thai AT_HUB
  const atHub = await as("kho", request(app).get(`/orders?status=AT_HUB&search=${code}`));
  assert.equal(atHub.body.meta.total, 1);

  let journey = null;
  for (let i = 0; i < 100 && !journey; i += 1) {
    journey = JSON.parse((await getRedis().get(`journey:${code}`)) || "null");
    if (!journey) await wait(50);
  }
  assert.ok(journey, "consumer da ghi hanh trinh");
  const keys = await getRedis().keys("ratelimit:tracking:*");
  if (keys.length) await getRedis().del(...keys);
  const tracked = await request(app).get(`/tracking/${code}`);
  assert.equal(tracked.body.data.groupLabel, "Đã nhận – Chưa giao");
  assert.deepEqual(tracked.body.data.events.map((e) => e.label), ["Chờ bưu cục xác nhận", "Đã xác nhận, chờ lấy hàng", "Đã nhập kho"]);
});
