// US-13: API quan tri bang gia - trung khoang hieu luc, bang gia da dung cho don hang.
// Dung bang gia seed EXPRESS x INTER_REGION (da co don hang) va tao bang gia thu o nam 2099.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User } from "../src/models/User.js";
import { ServiceType } from "../src/models/ServiceType.js";
import { PriceTable } from "../src/models/PriceTable.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const TEST_YEAR_FROM = new Date("2099-01-01");
const TIERS = [
  { fromGram: 0, toGram: 500, basePrice: 40000, pricePer500g: 6000 },
  { fromGram: 500, toGram: 999999999, basePrice: 48000, pricePer500g: 6000 },
];

let app;
let admin;
let customer;
let adminToken;
let customerToken;
let express;
let seeded;

async function restoreSeeded() {
  await PriceTable.deleteMany({ effectiveFrom: { $gte: TEST_YEAR_FROM } });
  if (seeded) await PriceTable.updateOne({ _id: seeded._id }, { effectiveTo: seeded.effectiveTo });
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: ["price-admin@edms.vn", "price-customer@edms.vn"] });
  // Lan chay bi ngat de lai bang gia thu / effectiveTo da sua: don truoc
  await PriceTable.deleteMany({ effectiveFrom: { $gte: TEST_YEAR_FROM } });
  express = await ServiceType.findOne({ code: "EXPRESS" }).lean();
  await PriceTable.updateOne({ serviceTypeId: express._id, zone: "INTER_REGION", effectiveTo: TEST_YEAR_FROM }, { effectiveTo: null });
  seeded = await PriceTable.findOne({ serviceTypeId: express._id, zone: "INTER_REGION" }).sort({ effectiveFrom: 1 }).lean();
  app = createApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  admin = await User.create({
    email: "price-admin@edms.vn",
    phone: "0909995101",
    passwordHash,
    fullName: "Price Admin",
    role: "ADMIN",
    status: "ACTIVE",
  });
  customer = await User.create({
    email: "price-customer@edms.vn",
    phone: "0909995102",
    passwordHash,
    fullName: "Price Customer",
    role: "CUSTOMER",
    status: "ACTIVE",
    customerType: "INDIVIDUAL",
  });
  adminToken = (await request(app).post("/auth/login").send({ emailOrPhone: admin.email, password: PASSWORD })).body.data
    .accessToken;
  customerToken = (await request(app).post("/auth/login").send({ emailOrPhone: customer.email, password: PASSWORD }))
    .body.data.accessToken;
});

// before() loi giua chung van phai don va dong ket noi, neu khong tien trinh test treo
after(async () => {
  try {
    await restoreSeeded();
    await User.deleteMany({ email: { $in: ["price-admin@edms.vn", "price-customer@edms.vn"] } });
  } finally {
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

const asAdmin = (req) => req.set("Authorization", `Bearer ${adminToken}`);
const body = (effectiveFrom, effectiveTo, weightTiers = TIERS) => ({
  serviceTypeId: express._id,
  zone: "INTER_REGION",
  weightTiers,
  effectiveFrom,
  effectiveTo,
});

test("[US-13] CUSTOMER khong vao duoc API quan tri bang gia", async () => {
  const res = await request(app).get("/priceTables").set("Authorization", `Bearer ${customerToken}`);
  assert.equal(res.status, 403);
});

test("[US-13] bang gia da dung cho don hang: khong xoa, khong sua bac, chi lui duoc effectiveTo", async () => {
  const del = await asAdmin(request(app).delete(`/priceTables/${seeded._id}`));
  assert.equal(del.status, 409);
  assert.match(del.body.error.message, /đã dùng cho đơn hàng/);

  const editTiers = await asAdmin(request(app).put(`/priceTables/${seeded._id}`)).send({ weightTiers: TIERS });
  assert.equal(editTiers.status, 409);

  const shorten = await asAdmin(request(app).put(`/priceTables/${seeded._id}`)).send({ effectiveTo: "2099-01-01" });
  assert.equal(shorten.status, 200);
  assert.equal(new Date(shorten.body.data.effectiveTo).toISOString(), TEST_YEAR_FROM.toISOString());
});

test("[US-13] hai bang gia cung dich vu + vung khong trung khoang hieu luc; noi tiep nhau thi duoc", async () => {
  const first = await asAdmin(request(app).post("/priceTables")).send(body("2099-01-01", "2099-07-01"));
  assert.equal(first.status, 201, JSON.stringify(first.body));

  const overlap = await asAdmin(request(app).post("/priceTables")).send(body("2099-06-01", null));
  assert.equal(overlap.status, 409);
  assert.match(overlap.body.error.message, /Trùng khoảng hiệu lực/);

  // [from, to) nua mo: bat dau dung ngay bang truoc het hieu luc -> khong trung
  const next = await asAdmin(request(app).post("/priceTables")).send(body("2099-07-01", null));
  assert.equal(next.status, 201, JSON.stringify(next.body));

  const list = await asAdmin(request(app).get("/priceTables")).query({ zone: "INTER_REGION", serviceTypeId: String(express._id) });
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((item) => item.serviceTypeId?.code === "EXPRESS"), "danh sach kem ten loai dich vu");
});

test("[US-13] tao bang gia co bac chong lan qua API bi 400, bang gia chua dung thi xoa duoc", async () => {
  const bad = await asAdmin(request(app).post("/priceTables")).send(
    body("2099-12-01", "2099-12-31", [
      { fromGram: 0, toGram: 600, basePrice: 1, pricePer500g: 1 },
      { fromGram: 500, toGram: 999999999, basePrice: 2, pricePer500g: 1 },
    ]),
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "VALIDATION_ERROR");

  const unused = await PriceTable.findOne({ effectiveFrom: { $gte: TEST_YEAR_FROM } }).lean();
  const del = await asAdmin(request(app).delete(`/priceTables/${unused._id}`));
  assert.equal(del.status, 200);
});
