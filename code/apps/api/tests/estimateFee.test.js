// US-16: uoc tinh phi cong khai + ban nhap don (draftToken, song 24 gio) giu du lieu
// khach vang lai da nhap qua buoc dang ky.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers, suspendAreas } from "./helpers/fixtures.js";
// Xa/phuong co that tam ngung phuc vu trong luc test -> dung lam dia chi "ngoai vung phuc vu"
const OUTSIDE = [{ province: "Lào Cai", ward: "Phường Sa Pa" }, { province: "Hà Nội", ward: "Xã Sóc Sơn" }];
let restoreAreas;

import { User } from "../src/models/User.js";
import { ServiceType } from "../src/models/ServiceType.js";
import { PriceTable } from "../src/models/PriceTable.js";
import { OrderDraft } from "../src/models/OrderDraft.js";
import { calculate } from "../src/modules/pricing/pricing.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["est-khach-a@edms.vn", "est-khach-b@edms.vn", "est-flow@edms.vn"];

let app;
let tokenA;
let tokenB;
const draftIds = [];

const ESTIMATE = {
  pickup: { province: "ha noi", ward: "cau giay" },
  receiver: { province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
  item: { weightGram: 1000, length: 40, width: 30, height: 20, declaredValue: 6000000 },
  flags: { fragile: true },
};

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  restoreAreas = await suspendAreas(OUTSIDE);
  app = createApp();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const customer = (email, phone) => ({ email, phone, passwordHash, fullName: email, role: "CUSTOMER", customerType: "INDIVIDUAL" });
  await User.create([customer(EMAILS[0], "0909981601"), customer(EMAILS[1], "0909981602")]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  tokenA = await login(EMAILS[0]);
  tokenB = await login(EMAILS[1]);
});

after(async () => {
  try {
    await OrderDraft.deleteMany({ _id: { $in: draftIds } });
    await User.deleteMany({ email: { $in: EMAILS } });
    await restoreAreas?.();
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

const estimate = (body) => request(app).post("/orders/estimate-fee").send(body);
async function saveDraft(payload, token) {
  const req = request(app).post("/orderDrafts");
  if (token) req.set("Authorization", `Bearer ${token}`);
  const res = await req.send({ payload });
  if (res.body.data) draftIds.push((await OrderDraft.findOne({ draftToken: res.body.data.draftToken }).lean())._id);
  return res;
}
const openDraft = (draftToken, token) => {
  const req = request(app).get(`/orderDrafts/${draftToken}`);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

test("[US-16] POST /orders/estimate-fee cong khai: khong can dang nhap, bao gia tung loai dich vu dung bang gia", async () => {
  const res = await estimate(ESTIMATE);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const data = res.body.data;
  assert.equal(data.zone, "INTER_REGION");
  assert.deepEqual([data.pickupArea.ward, data.receiverArea.ward], ["Phường Cầu Giấy", "Phường Sài Gòn"]);
  assert.equal(data.chargeableWeight, 4800, "40x30x20 cm quy doi 4,8 kg > 1 kg thuc");
  assert.deepEqual(data.flags, { fragile: true, highValue: true, isVehicle: false });
  assert.deepEqual(data.options.map((o) => o.code), ["STANDARD", "EXPRESS"]);
  // Ha Noi -> TP HCM: giao nhanh chi ap dung trong cung tinh -> liet ke kem ly do, khong co phi
  const fast = data.options.find((o) => o.code === "EXPRESS");
  assert.deepEqual([fast.available, fast.fee], [false, null]);
  assert.match(fast.reason, /chỉ áp dụng trong cùng tỉnh\/thành/);
  assert.ok(data.distanceKm > 1000, `Ha Noi - TP HCM ~1.100 km duong chim bay, nhan ${data.distanceKm}`);

  // Cung ket qua voi ham thuan pricing.calculate tren bang gia dang hieu luc LUC NAY (test
  // US-13 chay song song co the dang tao bang gia thu nghiem nam 2099 cung dich vu, cung vung)
  const now = new Date();
  for (const option of data.options.filter((o) => o.available)) {
    const serviceType = await ServiceType.findById(option.serviceTypeId).lean();
    const priceTable = await PriceTable.findOne({
      serviceTypeId: serviceType._id,
      zone: "INTER_REGION",
      isActive: true,
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
    }).lean();
    const expected = calculate({ item: ESTIMATE.item, flags: ESTIMATE.flags, serviceType, priceTable });
    assert.deepEqual(option.fee, expected.fee);
  }

  const express = data.options.find((o) => o.code === "EXPRESS");
  // Chi hoi gia giao nhanh cho don lien mien -> 422 kem ly do; trong cung tinh thi bao gia binh thuong
  const blocked = await estimate({ ...ESTIMATE, serviceTypeId: express.serviceTypeId });
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error.code, "SERVICE_NOT_AVAILABLE");
  const one = await estimate({ ...ESTIMATE, receiver: { province: "Hà Nội", ward: "Phường Hoàn Kiếm" }, serviceTypeId: express.serviceTypeId });
  assert.equal(one.status, 200, JSON.stringify(one.body));
  assert.deepEqual(one.body.data.options.map((o) => [o.code, o.available]), [["EXPRESS", true]]);
  assert.equal(one.body.data.zone, "INNER_PROVINCE");
});

test("[US-16] noi gui / noi nhan ngoai vung phuc vu bi chan va bao ro dau nao", async () => {
  const res = await estimate({ ...ESTIMATE, receiver: { province: "Lào Cai", ward: "Phường Sa Pa" } });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, "OUT_OF_SERVICE_AREA");
  assert.match(res.body.error.message, /Nơi nhận \(Phường Sa Pa, Lào Cai\)/);
  const pickup = await estimate({ ...ESTIMATE, pickup: { province: "Hà Nội", ward: "Xã Sóc Sơn" } });
  assert.match(pickup.body.error.message, /Nơi gửi/);
});

test("[US-16] du lieu kien hang sai bi 400 (khong tinh phi bua)", async () => {
  const cases = [
    { ...ESTIMATE, item: { ...ESTIMATE.item, weightGram: 0 } },
    { ...ESTIMATE, item: { ...ESTIMATE.item, height: -5 } },
    { ...ESTIMATE, item: { ...ESTIMATE.item, length: "abc" } },
    { ...ESTIMATE, pickup: undefined },
  ];
  for (const body of cases) {
    const res = await estimate(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
});

test("[US-16] luu nhap: draftToken ngau nhien, song dung 24 gio, qua 24 gio coi nhu het han", async () => {
  const res = await saveDraft({ step: 3, estimate: ESTIMATE });
  assert.equal(res.status, 201);
  const { draftToken, expiresAt, claimed } = res.body.data;
  assert.ok(draftToken.length >= 24, "token du dai, khong doan duoc");
  assert.equal(claimed, false);
  const hours = (new Date(expiresAt) - Date.now()) / 3600000;
  assert.ok(hours > 23.9 && hours <= 24, `con ${hours} gio`);
  assert.equal((await saveDraft({ step: 1 })).body.data.draftToken === draftToken, false);

  assert.deepEqual((await openDraft(draftToken)).body.data.payload, { step: 3, estimate: ESTIMATE });
  await OrderDraft.updateOne({ draftToken }, { createdAt: new Date(Date.now() - 25 * 3600000) });
  assert.equal((await openDraft(draftToken)).status, 404);
});

test("[US-16] payload nhap khong hop le bi 400", async () => {
  for (const payload of [["mang"], "chuoi", { $where: "1" }, { a: { "b.c": 1 } }, { big: "x".repeat(21000) }]) {
    assert.equal((await saveDraft(payload)).status, 400, JSON.stringify(payload).slice(0, 40));
  }
});

test("[US-16] nhap thuoc ve khach nao thi chi khach do mo / sua duoc", async () => {
  const { draftToken } = (await saveDraft({ step: 2 })).body.data;
  const claimed = await openDraft(draftToken, tokenA);
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.data.claimed, true);

  assert.equal((await openDraft(draftToken)).status, 404, "khach vang lai giu token cung khong mo duoc nua");
  assert.equal((await openDraft(draftToken, tokenB)).status, 404);
  const update = await request(app)
    .put(`/orderDrafts/${draftToken}`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ payload: { step: 3 } });
  assert.equal(update.status, 200);
  assert.deepEqual(update.body.data.payload, { step: 3 });
  const byOther = await request(app).put(`/orderDrafts/${draftToken}`).set("Authorization", `Bearer ${tokenB}`).send({ payload: {} });
  assert.equal(byOther.status, 404);
});

// LUONG nghiep vu cua story: khach vang lai uoc tinh phi -> bam "Gui hang" (luu nhap)
// -> dang ky tai khoan moi -> dang nhap -> mo lai nhap bang draftToken: moi thu da
// nhap con nguyen, nhap thanh cua tai khoan moi, phi tinh lai van nhu luc uoc tinh.
test("[US-16] luong nghiep vu: uoc tinh phi -> luu nhap -> dang ky -> dang nhap -> du lieu con nguyen", async () => {
  const quote = (await estimate(ESTIMATE)).body.data;
  const chosen = quote.options.find((o) => o.code === "STANDARD");
  const payload = { ...ESTIMATE, serviceTypeId: chosen.serviceTypeId, quotedTotal: chosen.fee.total };
  const { draftToken } = (await saveDraft(payload)).body.data;

  const register = await request(app).post("/auth/register").send({
    email: EMAILS[2],
    phone: "0909981609",
    password: PASSWORD,
    fullName: "Khách Mới",
    customerType: "INDIVIDUAL",
  });
  assert.equal(register.status, 201, JSON.stringify(register.body));
  const login = await request(app).post("/auth/login").send({ emailOrPhone: EMAILS[2], password: PASSWORD, app: "CUSTOMER" });
  assert.equal(login.status, 200);

  const reopened = await openDraft(draftToken, login.body.data.accessToken);
  assert.equal(reopened.status, 200);
  assert.deepEqual(reopened.body.data.payload, payload);
  assert.equal(reopened.body.data.claimed, true);
  const owner = await OrderDraft.findOne({ draftToken }).lean();
  assert.equal(String(owner.customerId), String(register.body.data.id));

  const again = await estimate({ ...reopened.body.data.payload });
  const sameService = again.body.data.options.find((o) => o.code === "STANDARD");
  assert.equal(sameService.fee.total, payload.quotedTotal);
});
