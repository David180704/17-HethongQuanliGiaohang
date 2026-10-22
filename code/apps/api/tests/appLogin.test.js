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
let hub;
let customer;
let shipper;
let hubStaff;

function login(emailOrPhone, appName, password = PASSWORD) {
  return request(app).post("/auth/login").send({ emailOrPhone, password, app: appName });
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  // Tao hub bang collection tho, KHONG import model Hub: server that cung khong
  // import Hub o dau ca, nen test phai chung minh auth.service tu dang ky model
  // truoc khi populate (loi MissingSchemaError da gap tren server that).
  const { insertedId } = await mongoose.connection.collection("hubs").insertOne({
    code: "HUB-TEST-APPLOGIN",
    name: "Hub Test App Login",
    type: "HUB",
    province: "Hà Nội",
    district: "Hoàn Kiếm",
    isActive: true,
  });
  hub = { _id: insertedId };
  customer = await User.create({
    email: "applogin-customer@edms.vn",
    phone: "0909994001",
    passwordHash,
    fullName: "Khách Test",
    role: "CUSTOMER",
    status: "ACTIVE",
    customerType: "INDIVIDUAL",
  });
  shipper = await User.create({
    email: "applogin-shipper@edms.vn",
    phone: "0909994002",
    passwordHash,
    fullName: "Tài Xế Test",
    role: "SHIPPER",
    status: "ACTIVE",
  });
  hubStaff = await User.create({
    email: "applogin-hub@edms.vn",
    phone: "0909994003",
    passwordHash,
    fullName: "Nhân Viên Kho Test",
    role: "HUB_STAFF",
    status: "ACTIVE",
    hubId: hub._id,
  });
});

after(async () => {
  await User.deleteMany({ _id: { $in: [customer._id, shipper._id, hubStaff._id] } });
  await mongoose.connection.collection("hubs").deleteOne({ _id: hub._id });
  await getRedis().quit();
  await mongoose.disconnect();
});

test("CUSTOMER dang nhap App Nhan vien bi tu choi WRONG_APP, khong duoc cap token", async () => {
  const res = await login(customer.email, "STAFF");
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "WRONG_APP");
  assert.match(res.body.error.message, /App Khách hàng/);
  assert.equal(res.body.data, undefined);
});

test("SHIPPER dang nhap App Khach hang bi tu choi WRONG_APP", async () => {
  const res = await login(shipper.email, "CUSTOMER");
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "WRONG_APP");
  assert.match(res.body.error.message, /App Nhân viên/);
});

test("Dung app thi dang nhap binh thuong: SHIPPER/HUB_STAFF -> STAFF, CUSTOMER -> CUSTOMER", async () => {
  for (const [user, appName] of [
    [shipper, "STAFF"],
    [hubStaff, "STAFF"],
    [customer, "CUSTOMER"],
  ]) {
    const res = await login(user.email, appName);
    assert.equal(res.status, 200, `${user.role} vao ${appName}`);
    assert.ok(res.body.data.accessToken);
    assert.equal(res.body.data.user.role, user.role);
  }
});

test("Sai mat khau o sai app van bao INVALID_CREDENTIALS (khong lo vai tro khi chua xac thuc)", async () => {
  const res = await login(customer.email, "STAFF", "sai-mat-khau");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
});

test("Dang nhap sai app nhieu lan khong tinh vao bo dem khoa tai khoan", async () => {
  for (let i = 0; i < 6; i += 1) {
    const res = await login(customer.email, "STAFF");
    assert.equal(res.body.error.code, "WRONG_APP");
  }
  const res = await login(customer.email, "CUSTOMER");
  assert.equal(res.status, 200, "mat khau dung nen khong duoc bi khoa");
});

test("Khong gui app thi khong gioi han vai tro (tuong thich Swagger/test cu)", async () => {
  const res = await request(app).post("/auth/login").send({ emailOrPhone: customer.email, password: PASSWORD });
  assert.equal(res.status, 200);
});

test("app khong hop le (ke ca ten thuoc tinh co san cua Object) tra 400, khong phai 500", async () => {
  for (const appName of ["ADMIN", "constructor", "__proto__", 123]) {
    const res = await login(customer.email, appName);
    assert.equal(res.status, 400, `app=${String(appName)}`);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
});

test("emailOrPhone dang object (thu NoSQL injection) tra 400, khong phai 500", async () => {
  const res = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: { $ne: null }, password: PASSWORD });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("GET /auth/me cua HUB_STAFF kem ten hub phu trach", async () => {
  const loginRes = await login(hubStaff.email, "STAFF");
  const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.hubId.code, "HUB-TEST-APPLOGIN");
  assert.equal(res.body.data.hubId.name, "Hub Test App Login");
  assert.equal(res.body.data.passwordHash, undefined);
});
