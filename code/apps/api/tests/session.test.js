import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";
const PASSWORD = "Test@12345";
let app;
let user;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();
  user = await User.create({
    email: "session-test@edms.vn",
    phone: "0909992001",
    passwordHash: await bcrypt.hash(PASSWORD, 10),
    fullName: "Session Test",
    role: "CUSTOMER",
    status: "ACTIVE",
    customerType: "INDIVIDUAL",
  });
});

after(async () => {
  await User.deleteOne({ _id: user._id });
  await getRedis().quit();
  await mongoose.disconnect();
});

async function doLogin() {
  const res = await request(app).post("/auth/login").send({ emailOrPhone: user.email, password: PASSWORD });
  return res.body.data;
}

test("refresh phat cap token moi va vo hieu refresh token cu", async () => {
  const { refreshToken } = await doLogin();

  const res = await request(app).post("/auth/refresh").send({ refreshToken });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);

  const reuse = await request(app).post("/auth/refresh").send({ refreshToken });
  assert.equal(reuse.status, 401);
});

test("logout vo hieu refresh token hien tai", async () => {
  const { refreshToken } = await doLogin();

  const out = await request(app).post("/auth/logout").send({ refreshToken });
  assert.equal(out.status, 200);

  const res = await request(app).post("/auth/refresh").send({ refreshToken });
  assert.equal(res.status, 401);
});

test("logout-all vo hieu toan bo refresh token da phat truoc do", async () => {
  const session1 = await doLogin();
  const session2 = await doLogin();

  const logoutAll = await request(app)
    .post("/auth/logout-all")
    .set("Authorization", `Bearer ${session1.accessToken}`);
  assert.equal(logoutAll.status, 200);

  const r1 = await request(app).post("/auth/refresh").send({ refreshToken: session1.refreshToken });
  const r2 = await request(app).post("/auth/refresh").send({ refreshToken: session2.refreshToken });
  assert.equal(r1.status, 401);
  assert.equal(r2.status, 401);

  const freshLogin = await doLogin();
  const r3 = await request(app).post("/auth/refresh").send({ refreshToken: freshLogin.refreshToken });
  assert.equal(r3.status, 200);
});

test("logout-all khong co token tra ve 401", async () => {
  const res = await request(app).post("/auth/logout-all");
  assert.equal(res.status, 401);
});
