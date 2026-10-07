import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";
const PASSWORD = "Test@12345";

let app;
let activeUser;
let pendingUser;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  activeUser = await User.create({
    email: "auth-test-active@edms.vn",
    phone: "0909990001",
    passwordHash,
    fullName: "Nguoi Dung Test",
    role: "CUSTOMER",
    status: "ACTIVE",
    customerType: "INDIVIDUAL",
  });
  pendingUser = await User.create({
    email: "auth-test-pending@edms.vn",
    phone: "0909990002",
    passwordHash,
    fullName: "Doanh Nghiep Chua Duyet",
    role: "CUSTOMER",
    status: "PENDING",
    customerType: "BUSINESS",
  });
});

after(async () => {
  await User.deleteMany({ _id: { $in: [activeUser._id, pendingUser._id] } });
  await mongoose.disconnect();
});

test("dang nhap dung thong tin tra ve cap Access/Refresh Token", async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: activeUser.email, password: PASSWORD });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
  assert.equal(res.body.data.user.role, "CUSTOMER");
});

test("sai mat khau tra ve 401 INVALID_CREDENTIALS", async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: activeUser.email, password: "sai-mat-khau" });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
});

test("tai khoan PENDING khong dang nhap duoc", async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: pendingUser.email, password: PASSWORD });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "ACCOUNT_NOT_ACTIVE");
});

test("thieu truong bat buoc tra ve 400 VALIDATION_ERROR", async () => {
  const res = await request(app).post("/auth/login").send({ emailOrPhone: activeUser.email });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("da dang nhap roi goi lai /auth/login bi chan (guard nguoc)", async () => {
  const login = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: activeUser.email, password: PASSWORD });
  const token = login.body.data.accessToken;

  const res = await request(app)
    .post("/auth/login")
    .set("Authorization", `Bearer ${token}`)
    .send({ emailOrPhone: activeUser.email, password: PASSWORD });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "ALREADY_AUTHENTICATED");
});

test("duong dan khong ton tai tra ve 404 NOT_FOUND", async () => {
  const res = await request(app).get("/khong-ton-tai");
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, "NOT_FOUND");
});
