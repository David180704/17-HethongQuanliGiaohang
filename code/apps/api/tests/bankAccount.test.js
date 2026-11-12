// US-42 (PB#12): khach khai bao tai khoan ngan hang nhan tien thu ho - ngan hang (danh sach co dinh), so tai khoan,
// chu tai khoan (tu bo dau, in hoa nhu tren the). Doi soat (Sprint 7) chuyen tien vao tai khoan nay.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getContainer } from "../src/container.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User } from "../src/models/index.js";
import { BANKS, parseBankAccount, toAccountName } from "../src/modules/profile/bankAccount.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const EMAILS = ["nh-shop@edms.vn", "nh-admin@edms.vn", "nh-tx@edms.vn"];

let app;
let token = {};
let shop;

const as = (who, req) => req.set("Authorization", `Bearer ${token[who]}`);
const VALID = { bankCode: "VCB", accountNumber: "0011 0044 55667", accountName: "Nguyễn Thị Đào" };

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: EMAILS });
  app = createApp();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  [shop] = await User.create([
    { email: EMAILS[0], phone: "0909982950", passwordHash, fullName: "Shop Ngân hàng", role: "CUSTOMER", customerType: "BUSINESS", shopName: "Shop NH", taxCode: "0101234567" },
    { email: EMAILS[1], phone: "0909982951", passwordHash, fullName: "Admin Ngân hàng", role: "ADMIN" },
    { email: EMAILS[2], phone: "0909982952", passwordHash, fullName: "Tài xế Ngân hàng", role: "SHIPPER" },
  ]);
  const login = async (email) =>
    (await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD })).body.data.accessToken;
  token = { shop: await login(EMAILS[0]), admin: await login(EMAILS[1]), tx: await login(EMAILS[2]) };
});

after(async () => {
  try {
    await User.deleteMany({ email: { $in: EMAILS } });
  } finally {
    await getContainer().orderEvents.close();
    await getRedis().quit();
    await mongoose.disconnect();
  }
});

test("[US-42] kiem tra du lieu: ngan hang trong danh sach, so tai khoan 6-19 chu so, ten chu tai khoan bo dau in hoa", () => {
  assert.equal(toAccountName("  Nguyễn   Văn Đức "), "NGUYEN VAN DUC");
  assert.deepEqual(parseBankAccount(VALID), { bankName: "Vietcombank", bankCode: "VCB", accountNumber: "0011004455667", accountName: "NGUYEN THI DAO" });
  assert.equal(parseBankAccount({ ...VALID, bankCode: undefined, bankName: "Techcombank" }).bankCode, "TCB");
  assert.throws(() => parseBankAccount({ ...VALID, bankCode: "XYZ" }), /Chọn ngân hàng/);
  assert.throws(() => parseBankAccount({ ...VALID, accountNumber: "12345" }), /6 đến 19/);
  assert.throws(() => parseBankAccount({ ...VALID, accountNumber: "12345abc9" }), /6 đến 19/);
  assert.throws(() => parseBankAccount({ ...VALID, accountName: "A1" }), /Tên chủ tài khoản/);
  assert.ok(BANKS.length >= 10);
});

test("[US-42] khach khai bao, doi, xoa tai khoan nhan thu ho; /auth/me tra kem; nguoi khong phai khach bi chan", async () => {
  assert.equal((await as("shop", request(app).get("/profile/bank-account")).expect(200)).body.data, null);
  await as("shop", request(app).put("/profile/bank-account")).send({ ...VALID, accountNumber: "12" }).expect(400);
  const saved = (await as("shop", request(app).put("/profile/bank-account")).send(VALID).expect(200)).body.data;
  assert.deepEqual(saved, { bankName: "Vietcombank", bankCode: "VCB", accountNumber: "0011004455667", accountName: "NGUYEN THI DAO" });
  const me = (await as("shop", request(app).get("/auth/me")).expect(200)).body.data;
  assert.equal((me.user || me).bankAccount.accountNumber, "0011004455667");

  const changed = (await as("shop", request(app).put("/profile/bank-account")).send({ bankCode: "TCB", accountNumber: "19033344455", accountName: "nguyen thi dao" }).expect(200)).body.data;
  assert.deepEqual([changed.bankName, changed.accountNumber], ["Techcombank", "19033344455"]);
  await as("shop", request(app).delete("/profile/bank-account")).expect(200);
  assert.equal((await as("shop", request(app).get("/profile/bank-account")).expect(200)).body.data, null);

  await as("tx", request(app).put("/profile/bank-account")).send(VALID).expect(403);
  await as("admin", request(app).put("/profile/bank-account")).send(VALID).expect(403);
  await request(app).put("/profile/bank-account").send(VALID).expect(401);
  const banks = (await request(app).get("/profile/banks").expect(200)).body.data;
  assert.deepEqual(banks[0], { code: "VCB", name: "Vietcombank" });
});

test("[US-42] luong nghiep vu: shop khai bao tai khoan -> quan tri vien thay ngay o ho so shop (khong doi cache 30 giay) -> shop doi tai khoan -> quan tri vien thay so moi", async () => {
  await as("shop", request(app).put("/profile/bank-account")).send(VALID).expect(200);
  // Quan tri doc qua repository co cache: lan doc dau dua vao cache
  let seen = (await as("admin", request(app).get(`/users/${shop._id}`)).expect(200)).body.data;
  assert.equal(seen.bankAccount.accountName, "NGUYEN THI DAO");
  await as("shop", request(app).put("/profile/bank-account")).send({ bankCode: "MB", accountNumber: "0909982950", accountName: "Shop NH" }).expect(200);
  seen = (await as("admin", request(app).get(`/users/${shop._id}`)).expect(200)).body.data;
  assert.deepEqual([seen.bankAccount.bankName, seen.bankAccount.accountNumber, seen.bankAccount.accountName], ["MB Bank", "0909982950", "SHOP NH"]);
});
