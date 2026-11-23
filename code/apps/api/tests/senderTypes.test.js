// Hai nhom nguoi gui (23/11/2026): khach le gui hang khong kem thu ho, khong co tai khoan nhan COD, khong co doi soat;
// chi shop doi tac (tai khoan doanh nghiep da duyet) moi gui thu ho (COD), tru phi vao thu ho, khai tai khoan ngan
// hang va duoc doi soat dinh ky. Ap dung ca don tao online va don tao tai quay.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User, Hub, ServiceType, PickupLocation, Order } from "../src/models/index.js";
import { assertCodAllowed } from "../src/modules/orders/cod.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["st-le@edms.vn", "st-shop@edms.vn", "st-kho@edms.vn", "st-admin@edms.vn"];
const WALK_IN = "0909983509";

let app;
let standard;
const token = {};
const loc = {};

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  await User.deleteMany({ phone: WALK_IN });
  app = createApp();
  standard = await ServiceType.findOne({ code: "STANDARD" }).lean();
  const hub = await Hub.findOne({ code: "HUB-HN" }).lean();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create([
    { email: EMAILS[0], phone: "0909983501", passwordHash, fullName: "Khách Lẻ Gửi Quà", role: "CUSTOMER", customerType: "INDIVIDUAL", status: "ACTIVE" },
    { email: EMAILS[1], phone: "0909983502", passwordHash, fullName: "Chủ Shop", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop Đối Tác ST", taxCode: "0312345688", status: "ACTIVE" },
    { email: EMAILS[2], phone: "0909983503", passwordHash, fullName: "Kho HN ST", role: "HUB_STAFF", hubId: hub._id },
    { email: EMAILS[3], phone: "0909983504", passwordHash, fullName: "Kế toán ST", role: "ADMIN" },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  [token.le, token.shop, token.kho, token.admin] = await Promise.all(EMAILS.map(login));
  for (const [who, phone] of [["le", "0909983501"], ["shop", "0909983502"]]) {
    loc[who] = (
      await request(app).post("/pickupLocations").set("Authorization", `Bearer ${token[who]}`).send({
        label: "Nhà", contactName: "Người gửi", contactPhone: phone, address: "1 Xuân Thủy", province: "Hà Nội", ward: "Phường Cầu Giấy",
      })
    ).body.data;
  }
});

after(async () => {
  try {
    const ids = (await User.find({ $or: [{ email: { $in: EMAILS } }, { phone: WALK_IN }] }).select("_id").lean()).map((u) => u._id);
    await Order.deleteMany({ customerId: { $in: ids } });
    await PickupLocation.deleteMany({ customerId: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const receiver = { name: "E2E Người Nhận ST", phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" };
const order = (who, cod) =>
  as(who, request(app).post("/orders")).send({
    pickupLocationId: loc[who]._id,
    serviceTypeId: standard._id,
    receiver,
    item: { name: "Quà sinh nhật", weightGram: 800, length: 20, width: 15, height: 10 },
    cod,
  });

test("[US-19] thu ho chi danh cho shop doi tac (ham thuan)", () => {
  const shop = { role: "CUSTOMER", customerType: "BUSINESS" };
  const le = { role: "CUSTOMER", customerType: "INDIVIDUAL" };
  assert.doesNotThrow(() => assertCodAllowed({ enabled: true, feePayer: "RECIPIENT_PAID" }, shop));
  assert.doesNotThrow(() => assertCodAllowed({ enabled: false, feePayer: "RECIPIENT_PAID" }, le));
  assert.throws(() => assertCodAllowed({ enabled: true, feePayer: "RECIPIENT_PAID" }, le), { code: "SHOP_ONLY" });
  assert.throws(() => assertCodAllowed({ enabled: false, feePayer: "DEDUCT_FROM_COD" }, le), { code: "SHOP_ONLY" });
  assert.throws(() => assertCodAllowed({ enabled: true, feePayer: "RECIPIENT_PAID" }, null), { code: "SHOP_ONLY" }, "khach moi tai quay");
});

test("[US-19] khach le gui hang: tra truoc hoac nguoi nhan tra; bat thu ho / tru phi vao thu ho bi chan", async () => {
  const withCod = await order("le", { enabled: true, amount: 300000, feePayer: "RECIPIENT_PAID" });
  assert.equal(withCod.status, 403);
  assert.equal(withCod.body.error.code, "SHOP_ONLY");
  assert.match(withCod.body.error.message, /chỉ dành cho shop đối tác/);
  assert.equal((await order("le", { enabled: true, amount: 300000, feePayer: "DEDUCT_FROM_COD" })).status, 403);
  assert.equal((await order("le", { enabled: false, feePayer: "RECIPIENT_PAID" })).status, 201, "nguoi nhan tra phi");
  assert.equal((await order("le", { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "CASH" })).status, 201, "tra truoc");
});

test("[US-42] tai khoan nhan tien thu ho chi danh cho shop doi tac", async () => {
  const bank = { bankCode: "VCB", accountNumber: "0011001234567", accountName: "CHU SHOP" };
  const le = await as("le", request(app).put("/profile/bank-account")).send(bank);
  assert.equal(le.status, 403);
  assert.equal(le.body.error.code, "SHOP_ONLY");
  assert.equal((await as("le", request(app).get("/profile/bank-account"))).status, 403);
  const shop = await as("shop", request(app).put("/profile/bank-account")).send(bank);
  assert.equal(shop.status, 200, JSON.stringify(shop.body));
});

test("[US-40] tai quay: khach le (ke ca khach moi) khong gui thu ho, gui thuong thi tao duoc", async () => {
  const body = (cod) => ({
    customer: { phone: WALK_IN, fullName: "Khách Vãng Lai Quầy" },
    serviceTypeId: standard._id,
    receiver,
    item: { name: "Giấy tờ", weightGram: 300, length: 30, width: 20, height: 2 },
    cod,
  });
  const blocked = await as("kho", request(app).post("/orders/counter")).send(body({ enabled: true, amount: 200000, feePayer: "RECIPIENT_PAID" }));
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, "SHOP_ONLY");
  assert.equal(await User.countDocuments({ phone: WALK_IN }), 0, "khong tao khach khi bi chan");
  const ok = await as("kho", request(app).post("/orders/counter")).send(body({ enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "CASH" }));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

// LUONG nghiep vu: khach le va shop cung gui hang. Ca hai don duoc giao; cuoi ky ke toan doi soat thi chi shop co ky
// doi soat (tien thu ho tru phi), don cua khach le khong vao doi soat.
test("[US-34] luong nghiep vu: khach le gui qua (khong thu ho), shop gui don co COD -> giao xong -> doi soat chi gom don cua shop", async () => {
  const gift = (await order("le", { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "CASH" })).body.data;
  const sale = (await order("shop", { enabled: true, amount: 450000, feePayer: "DEDUCT_FROM_COD" })).body.data;
  assert.ok(gift?._id && sale?._id);
  // Cac buoc van chuyen da kiem o US-25 -> US-33: ghi thang ket qua giao
  const at = new Date();
  for (const o of [gift, sale]) {
    await Order.updateOne(
      { _id: o._id },
      {
        $set: { status: "DELIVERED", "cod.collected": o._id === sale._id, "cod.collectedAt": at, "cod.feePaid": true, "cod.feePaidAt": at },
        $push: { statusHistory: { status: "DELIVERED", at, note: "Giao thành công" } },
      },
    );
  }
  // Ky doi soat theo ngay (gio Viet Nam): hom nay
  const from = new Date(at.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const to = from;
  const preview = await as("admin", request(app).post("/settlements/preview")).send({ from, to });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  const shopIds = preview.body.data.map((s) => String(s.customerId));
  const [leUser, shopUser] = await Promise.all([User.findOne({ email: EMAILS[0] }).lean(), User.findOne({ email: EMAILS[1] }).lean()]);
  assert.ok(shopIds.includes(String(shopUser._id)), "shop co trong ky doi soat");
  assert.ok(!shopIds.includes(String(leUser._id)), "khach le khong co doi soat");
  const direct = await as("admin", request(app).post("/settlements/preview")).send({ from, to, customerId: String(leUser._id) });
  assert.equal(direct.status, 403);
  assert.equal(direct.body.error.code, "SHOP_ONLY");
});
