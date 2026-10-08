import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";
let app;
const createdEmails = [];

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();
});

after(async () => {
  await User.deleteMany({ email: { $in: createdEmails } });
  await getRedis().quit();
  await mongoose.disconnect();
});

test("dang ky ca nhan duoc kich hoat ACTIVE ngay", async () => {
  const email = "reg-individual@edms.vn";
  createdEmails.push(email);

  const res = await request(app).post("/auth/register").send({
    email,
    phone: "0909991001",
    password: "Test@12345",
    fullName: "Nguyen Van A",
    customerType: "INDIVIDUAL",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "ACTIVE");
  assert.equal(res.body.data.customerType, "INDIVIDUAL");
});

test("dang ky doanh nghiep bi PENDING cho duyet", async () => {
  const email = "reg-business@edms.vn";
  createdEmails.push(email);

  const res = await request(app).post("/auth/register").send({
    email,
    phone: "0909991002",
    password: "Test@12345",
    fullName: "Tran Thi B",
    customerType: "BUSINESS",
    shopName: "Shop B",
    taxCode: "0123456789",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "PENDING");
});

test("doanh nghiep thieu shopName/taxCode bi tu choi 400", async () => {
  const res = await request(app).post("/auth/register").send({
    email: "reg-missing@edms.vn",
    phone: "0909991003",
    password: "Test@12345",
    fullName: "Thieu Thong Tin",
    customerType: "BUSINESS",
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("email da ton tai bi tu choi 409", async () => {
  const email = "reg-dup@edms.vn";
  createdEmails.push(email);

  const first = await request(app).post("/auth/register").send({
    email,
    phone: "0909991004",
    password: "Test@12345",
    fullName: "Nguoi Thu Nhat",
    customerType: "INDIVIDUAL",
  });
  assert.equal(first.status, 201);

  const dup = await request(app).post("/auth/register").send({
    email,
    phone: "0909991005",
    password: "Test@12345",
    fullName: "Nguoi Thu Hai",
    customerType: "INDIVIDUAL",
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "EMAIL_ALREADY_EXISTS");
});

test("da dang nhap roi goi /auth/register bi chan (guard nguoc)", async () => {
  const email = "reg-guard@edms.vn";
  createdEmails.push(email);

  const regRes = await request(app).post("/auth/register").send({
    email,
    phone: "0909991006",
    password: "Test@12345",
    fullName: "Guard Test",
    customerType: "INDIVIDUAL",
  });
  const login = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: email, password: "Test@12345" });
  const token = login.body.data.accessToken;

  const res = await request(app)
    .post("/auth/register")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "khong-quan-trong@edms.vn", phone: "0909999999", password: "x", fullName: "x", customerType: "INDIVIDUAL" });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "ALREADY_AUTHENTICATED");
  assert.ok(regRes.status === 201);
});
