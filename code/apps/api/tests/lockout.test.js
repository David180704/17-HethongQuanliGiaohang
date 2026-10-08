import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { resetAttempts } from "../src/core/loginThrottle.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";
const PASSWORD = "Test@12345";

let app;
let user;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();
  user = await User.create({
    email: "lockout-test@edms.vn",
    phone: "0909990099",
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    fullName: "Test Khoa Tai Khoan",
    role: "CUSTOMER",
    status: "ACTIVE",
    customerType: "INDIVIDUAL",
  });
  await resetAttempts(user.email);
});

after(async () => {
  await resetAttempts(user.email);
  await User.deleteOne({ _id: user._id });
  await getRedis().quit();
  await mongoose.disconnect();
});

test("khoa tai khoan 15 phut sau 5 lan sai mat khau lien tiep", async () => {
  for (let i = 0; i < 4; i++) {
    const res = await request(app).post("/auth/login").send({ emailOrPhone: user.email, password: "sai" });
    assert.equal(res.status, 401, `lan sai thu ${i + 1} phai la 401`);
  }

  // Lan sai thu 5 vuot nguong ngay tai luc nay nen bao khoa luon (423), khong
  // con la 401 nua - thong bao som hon de nguoi dung biet da bi khoa.
  const fifthRes = await request(app).post("/auth/login").send({ emailOrPhone: user.email, password: "sai" });
  assert.equal(fifthRes.status, 423);
  assert.equal(fifthRes.body.error.code, "ACCOUNT_LOCKED");

  const lockedRes = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: user.email, password: PASSWORD });

  assert.equal(lockedRes.status, 423);
  assert.equal(lockedRes.body.error.code, "ACCOUNT_LOCKED");
});

test("dang nhap dung truoc khi du 5 lan se reset bo dem", async () => {
  await resetAttempts(user.email);

  for (let i = 0; i < 3; i++) {
    await request(app).post("/auth/login").send({ emailOrPhone: user.email, password: "sai" });
  }

  const okRes = await request(app).post("/auth/login").send({ emailOrPhone: user.email, password: PASSWORD });
  assert.equal(okRes.status, 200);

  const after1 = await request(app).post("/auth/login").send({ emailOrPhone: user.email, password: "sai" });
  assert.equal(after1.status, 401);
});
