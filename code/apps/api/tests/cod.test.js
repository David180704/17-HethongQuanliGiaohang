// US-19: thu ho COD va 3 hinh thuc tra phi van chuyen.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, ServiceType, PickupLocation, Order } from "../src/models/index.js";
import { Counter } from "../src/models/Counter.js";
import { parseCod, assertCodCoversFee, codSummary } from "../src/modules/orders/cod.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["cod-shop@edms.vn", "cod-kho@edms.vn"];

let app;
let shopToken;
let staffToken;
let standard;
let location;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  app = createApp();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const hub = await mongoose.connection.collection("hubs").findOne({ code: "HUB-HCM" });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909981901", passwordHash, fullName: "Chủ Shop COD", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop COD", taxCode: "0312345678", status: "ACTIVE" },
    { email: EMAILS[1], phone: "0909981902", passwordHash, fullName: "Kho HCM COD", role: "HUB_STAFF", hubId: hub._id },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  shopToken = await login(EMAILS[0]);
  staffToken = await login(EMAILS[1]);
  location = (
    await request(app).post("/pickupLocations").set("Authorization", `Bearer ${shopToken}`).send({
      label: "Shop Quận 3",
      contactName: "Chủ Shop COD",
      contactPhone: "0909981901",
      address: "10 Võ Văn Tần",
      province: "TP Hồ Chí Minh",
      ward: "Phường Xuân Hòa",
    })
  ).body.data;
});

after(async () => {
  try {
    const users = await User.find({ email: { $in: EMAILS } }).select("_id").lean();
    const ids = users.map((u) => u._id);
    await Order.deleteMany({ customerId: { $in: ids } });
    await PickupLocation.deleteMany({ customerId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

// Noi tinh HCM (Quan 3 -> Quan 7), 800 g: bac 500-1000 g noi tinh = 24.000 d
const FEE = 24000;
const createOrder = (cod) =>
  request(app)
    .post("/orders")
    .set("Authorization", `Bearer ${shopToken}`)
    .send({
      pickupLocationId: location._id,
      serviceTypeId: standard._id,
      receiver: { name: "Người Mua", phone: "0987654321", address: "9 Nguyễn Thị Thập", province: "TP Hồ Chí Minh", ward: "Phường Tân Mỹ" },
      item: { name: "Áo thun", weightGram: 800, length: 20, width: 15, height: 5 },
      cod,
    });
const rejects = (cod, pattern) =>
  assert.throws(() => parseCod(cod), (err) => err.code === "VALIDATION_ERROR" && pattern.test(err.message));

test("[US-19] luat thu ho (ham thuan): mac dinh, gioi han tien, nguoi gui tra truoc phai chon QR/tien mat", () => {
  assert.deepEqual(parseCod(undefined), { enabled: false, amount: 0, feePayer: "RECIPIENT_PAID", feePaymentMethod: null });
  rejects({ enabled: true, amount: 0 }, /lớn hơn 0/);
  rejects({ enabled: true, amount: -5000 }, /lớn hơn 0/);
  rejects({ enabled: true, amount: 20_000_001 }, /tối đa 20\.000\.000 đ/);
  assert.equal(parseCod({ enabled: true, amount: 20_000_000 }).amount, 20_000_000);
  rejects({ feePayer: "SHOP_PREPAID" }, /QR hoặc tiền mặt/);
  rejects({ feePayer: "DEDUCT_FROM_COD" }, /phải bật thu hộ/);
  rejects({ feePayer: "FREE" }, /Hình thức trả phí/);
  // Thu ho tat thi so tien bi bo qua; khong phai SHOP_PREPAID thi khong luu phuong thuc tra phi
  assert.deepEqual(parseCod({ enabled: false, amount: 999, feePayer: "RECIPIENT_PAID", feePaymentMethod: "QR" }), {
    enabled: false,
    amount: 0,
    feePayer: "RECIPIENT_PAID",
    feePaymentMethod: null,
  });
});

test("[US-19] so tien shipper thu va shop nhan lai theo 3 hinh thuc tra phi", () => {
  const fee = { total: 30000 };
  const cod = (feePayer) => ({ enabled: true, amount: 500000, feePayer });
  assert.deepEqual(codSummary(cod("SHOP_PREPAID"), fee), { collectFromReceiver: 500000, payToShop: 500000 });
  assert.deepEqual(codSummary(cod("RECIPIENT_PAID"), fee), { collectFromReceiver: 530000, payToShop: 500000 });
  assert.deepEqual(codSummary(cod("DEDUCT_FROM_COD"), fee), { collectFromReceiver: 500000, payToShop: 470000 });
  assert.deepEqual(codSummary({ enabled: false, amount: 0, feePayer: "RECIPIENT_PAID" }, fee), {
    collectFromReceiver: 30000,
    payToShop: 0,
  });
  assert.throws(() => assertCodCoversFee({ feePayer: "DEDUCT_FROM_COD", amount: 29999 }, fee), { code: "COD_LESS_THAN_FEE" });
  assert.doesNotThrow(() => assertCodCoversFee({ feePayer: "DEDUCT_FROM_COD", amount: 30000 }, fee));
});

test("[US-19] 3 hinh thuc tra phi luu dung vao don", async () => {
  const prepaid = await createOrder({ enabled: true, amount: 350000, feePayer: "SHOP_PREPAID", feePaymentMethod: "QR" });
  assert.equal(prepaid.status, 201, JSON.stringify(prepaid.body));
  assert.equal(prepaid.body.data.fee.total, FEE);
  assert.deepEqual(
    (({ enabled, amount, feePayer, feePaymentMethod, feePaid }) => ({ enabled, amount, feePayer, feePaymentMethod, feePaid }))(prepaid.body.data.cod),
    { enabled: true, amount: 350000, feePayer: "SHOP_PREPAID", feePaymentMethod: "QR", feePaid: false },
  );
  const cash = await createOrder({ feePayer: "SHOP_PREPAID", feePaymentMethod: "CASH" });
  assert.deepEqual([cash.body.data.cod.enabled, cash.body.data.cod.feePaymentMethod], [false, "CASH"]);

  const recipient = await createOrder({ enabled: true, amount: 200000, feePayer: "RECIPIENT_PAID" });
  assert.equal(recipient.body.data.cod.feePayer, "RECIPIENT_PAID");
  assert.equal(recipient.body.data.cod.feePaymentMethod, null);

  const deduct = await createOrder({ enabled: true, amount: 200000, feePayer: "DEDUCT_FROM_COD" });
  assert.equal(deduct.status, 201);
  assert.equal(deduct.body.data.cod.feePayer, "DEDUCT_FROM_COD");
});

test("[US-19] COD > 0 khi bat, toi da 20.000.000 dong", async () => {
  assert.equal((await createOrder({ enabled: true, amount: 0 })).status, 400);
  const tooMuch = await createOrder({ enabled: true, amount: 20_000_001 });
  assert.equal(tooMuch.status, 400);
  assert.match(tooMuch.body.error.message, /20\.000\.000/);
  const max = await createOrder({ enabled: true, amount: 20_000_000 });
  assert.equal(max.status, 201);
  assert.equal(max.body.data.cod.amount, 20_000_000);
});

test("[US-19] chan luu khi khau tru phi vao thu ho ma tien thu ho nho hon phi", async () => {
  const counterBefore = (await Counter.findById("trackingCode").lean()).seq;
  const ordersBefore = await Order.countDocuments({ customerName: "Shop COD" });
  const blocked = await createOrder({ enabled: true, amount: FEE - 1, feePayer: "DEDUCT_FROM_COD" });
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error.code, "COD_LESS_THAN_FEE");
  assert.match(blocked.body.error.message, /23\.999 đ nhỏ hơn phí vận chuyển 24\.000 đ/);
  assert.equal(await Order.countDocuments({ customerName: "Shop COD" }), ordersBefore, "khong luu don");
  assert.equal((await Counter.findById("trackingCode").lean()).seq, counterBefore, "khong ton ma van don");

  const exact = await createOrder({ enabled: true, amount: FEE, feePayer: "DEDUCT_FROM_COD" });
  assert.equal(exact.status, 201, "thu ho bang dung phi van hop le (shop nhan lai 0 d)");
});

// LUONG nghiep vu cua story: shop ban hang thu ho 500.000 d, chon khau tru phi vao thu ho
// -> tao don -> buu cuc xac nhan -> khi giao, shipper thu dung 500.000 d cua nguoi mua,
// Express tra lai shop 500.000 d - phi (so lieu dung cho doi soat Sprint 5).
test("[US-19] luong nghiep vu: shop thu ho 500.000 d khau tru phi -> tao don -> buu cuc duyet -> so tien thu / tra lai dung", async () => {
  const created = await createOrder({ enabled: true, amount: 500000, feePayer: "DEDUCT_FROM_COD" });
  assert.equal(created.status, 201);
  const { _id, fee } = created.body.data;

  const confirmed = await request(app).post(`/orders/${_id}/confirm`).set("Authorization", `Bearer ${staffToken}`);
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

  const order = (await request(app).get(`/orders/${_id}`).set("Authorization", `Bearer ${shopToken}`)).body.data;
  assert.equal(order.status, "CONFIRMED");
  assert.deepEqual(codSummary(order.cod, order.fee), { collectFromReceiver: 500000, payToShop: 500000 - fee.total });
  assert.equal(order.cod.collected, false, "chua giao thi chua thu tien");
});
