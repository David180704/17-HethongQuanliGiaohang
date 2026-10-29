// Test CHAP NHAN theo tung story (tieu chi lay tu Sprint Planning 1-2 va cot
// Notes cua Sprint Backlog). Bo sung cho cac story con it test.
// Chay rieng 1 story:  npm run test:story -- 5      (hoac 05, US-05)
//
// Can CSDL local da seed: npm run seed:local
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { getRedis } from "../src/config/redis.js";
import { ErrorCodes } from "../src/core/errors.js";
import { swaggerSpec } from "../src/docs/swagger.js";
import { ORDER_STATUS } from "../src/constants/enums.js";
import { serviceAreas as seedAreas, hubs as seedHubs, routes as seedRoutes } from "../src/seed/referenceData.js";
import { Role, User, Hub, Route, ServiceArea, ServiceType, PriceTable, Order } from "../src/models/index.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const PASSWORD = "Test@12345";
const fromApiRoot = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

let app;
let admin;
let hubStaff;
let customer;
let adminToken;

async function loginToken(email) {
  const res = await request(app).post("/auth/login").send({ emailOrPhone: email, password: PASSWORD });
  return res.body.data;
}

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  await removeLeftovers({ emails: ["story-admin@edms.vn", "story-khach@edms.vn", "story-kho@edms.vn"] });
  app = createApp();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const hub = await Hub.findOne({ code: "HUB-HN" });
  [admin, hubStaff, customer] = await User.create([
    { email: "story-admin@edms.vn", phone: "0909996001", passwordHash, fullName: "Story Admin", role: "ADMIN" },
    {
      email: "story-kho@edms.vn",
      phone: "0909996002",
      passwordHash,
      fullName: "Story Kho",
      role: "HUB_STAFF",
      hubId: hub?._id,
    },
    {
      email: "story-khach@edms.vn",
      phone: "0909996003",
      passwordHash,
      fullName: "Story Khach",
      role: "CUSTOMER",
      customerType: "INDIVIDUAL",
    },
  ]);
  adminToken = (await loginToken(admin.email)).accessToken;
});

after(async () => {
  await User.deleteMany({ _id: { $in: [admin._id, hubStaff._id, customer._id] } });
  await ServiceArea.deleteMany({ province: "Tỉnh Story" });
  await getRedis().quit();
  await mongoose.disconnect();
});

// ---------------- Sprint 1 ----------------

test("[US-01] API song (/health) va da ket noi MongoDB", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "ok");
  assert.equal(res.body.data.database.state, "connected");
});

test("[US-01] Redis trong Docker tra loi PING", async () => {
  assert.equal(await getRedis().ping(), "PONG");
});

test("[US-01] docker-compose khai bao MongoDB replica set rs0 va Redis", async () => {
  const compose = await readFile(fromApiRoot("../../docker-compose.yml"), "utf8");
  assert.match(compose, /mongo:7/);
  assert.match(compose, /--replSet\s+rs0|replSet.*rs0/);
  assert.match(compose, /redis:7/);
});

test("[US-02] Du 12 Mongoose model", async () => {
  const expected = ["Role", "User", "Hub", "Route", "ServiceArea", "Shift", "ServiceType", "PriceTable", "PickupLocation", "Order", "OrderDraft", "Assignment"];
  await import("../src/models/index.js");
  for (const name of expected) assert.ok(mongoose.modelNames().includes(name), `thieu model ${name}`);
});

test("[US-02] Du 4 chi muc bat buoc (unique trackingCode, TTL orderDrafts 24h...)", async () => {
  const orders = await mongoose.connection.collection("orders").indexes();
  const tracking = orders.find((i) => i.key.trackingCode === 1);
  assert.ok(tracking?.unique, "orders.trackingCode phai unique");
  assert.ok(orders.some((i) => i.key.customerId === 1 && i.key.status === 1 && i.key.createdAt === -1));
  const assignments = await mongoose.connection.collection("assignments").indexes();
  assert.ok(assignments.some((i) => i.key.shipperId === 1 && i.key.shiftDate === 1 && i.key.status === 1));
  const drafts = await mongoose.connection.collection("orderdrafts").indexes();
  assert.equal(drafts.find((i) => i.key.createdAt === 1)?.expireAfterSeconds, 86400);
});

test("[US-02] Seed du lieu: 5 vai tro, 19 tai khoan test, 4 tuyen, 20 khu vuc, 3 hub, 2 dich vu, 8 bang gia", async () => {
  const roleCodes = (await Role.find().lean()).map((r) => r.code).sort();
  assert.deepEqual(roleCodes, ["ADMIN", "CUSTOMER", "GUEST", "HUB_STAFF", "SHIPPER"]);

  const seedAccounts = await User.find({ email: /^(admin|kho\d|taixe\d|khach\d|shop\d)@edms\.vn$/ }).lean();
  const byRole = (role) => seedAccounts.filter((u) => u.role === role).length;
  assert.deepEqual(
    { ADMIN: byRole("ADMIN"), HUB_STAFF: byRole("HUB_STAFF"), SHIPPER: byRole("SHIPPER"), CUSTOMER: byRole("CUSTOMER") },
    { ADMIN: 1, HUB_STAFF: 3, SHIPPER: 5, CUSTOMER: 10 },
  );

  assert.equal(await Route.countDocuments({ code: { $in: seedRoutes.map((r) => r.code) } }), 4);
  assert.equal(await Hub.countDocuments({ code: { $in: seedHubs.map((h) => h.code) } }), 3);
  for (const area of seedAreas) {
    assert.ok(await ServiceArea.exists({ province: area.province, district: area.district }), `thieu ${area.district}`);
  }
  assert.equal(seedAreas.length, 20);
  assert.equal(await ServiceType.countDocuments(), 2);
  assert.equal(await PriceTable.countDocuments({ effectiveFrom: new Date("2026-01-01") }), 8);
});

test("[US-02] Seed 200 don hang trai du 18 trang thai, ma van don EXP + 10 chu so", async () => {
  assert.equal(await Order.countDocuments(), 200);
  const statuses = await Order.distinct("status");
  assert.equal(ORDER_STATUS.length, 18);
  for (const status of ORDER_STATUS) assert.ok(statuses.includes(status), `thieu don o trang thai ${status}`);
  const badCodes = await Order.countDocuments({ trackingCode: { $not: /^EXP\d{10}$/ } });
  assert.equal(badCodes, 0);
});

test("[US-03] Access Token song 15 phut, Refresh Token song 7 ngay", async () => {
  const { accessToken, refreshToken } = await loginToken(customer.email);
  const access = jwt.decode(accessToken);
  const refresh = jwt.decode(refreshToken);
  assert.equal(access.exp - access.iat, 15 * 60);
  assert.equal(refresh.exp - refresh.iat, 7 * 24 * 60 * 60);
});

test("[US-03] Token cua HUB_STAFF mang hubId (co so gioi han theo diem phu trach)", async () => {
  const { accessToken } = await loginToken(hubStaff.email);
  const payload = jwt.decode(accessToken);
  assert.equal(payload.role, "HUB_STAFF");
  assert.equal(payload.hubId, String(hubStaff.hubId));
});

test("[US-04] Response thanh cong dung khuon { success: true, data }", async () => {
  const res = await request(app).get("/public/service-types");
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
});

test("[US-04] Response loi dung khuon { success: false, error: { code, message } }, ma loi VIET_HOA", async () => {
  const res = await request(app).get("/users");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.code, /^[A-Z][A-Z_]+$/);
  assert.ok(res.body.error.message.length > 0);
});

test("[US-04] Moi ma loi trong core/errors.js viet HOA_GACH_DUOI va co thong bao tieng Viet", () => {
  for (const [name, factory] of Object.entries(ErrorCodes)) {
    assert.match(name, /^[A-Z][A-Z_]+$/, name);
    const err = factory();
    assert.equal(err.code, name);
    assert.ok(err.message.length > 0, `${name} thieu thong bao`);
  }
});

test("[US-04] Ma dinh danh sai dinh dang tra 400, khong phai loi 500", async () => {
  const res = await request(app).get("/users/khong-phai-id").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});

test("[US-04] Tai lieu Swagger mo duoc o /api-docs va mo ta du cac API", async () => {
  const res = await request(app).get("/api-docs/");
  assert.equal(res.status, 200);
  const paths = Object.keys(swaggerSpec.paths);
  for (const path of ["/auth/login", "/auth/register", "/auth/logout", "/users", "/routes", "/serviceAreas", "/serviceTypes"]) {
    assert.ok(paths.includes(path), `Swagger thieu ${path}`);
  }
});

// ---------------- Sprint 2 ----------------

test("[US-05] CI GitHub Actions chay lint -> test -> build khi push va pull request", async () => {
  const ci = await readFile(fromApiRoot("../../../.github/workflows/ci.yml"), "utf8");
  assert.match(ci, /on:[\s\S]*push/);
  assert.match(ci, /pull_request/);
  assert.match(ci, /npm run lint/);
  assert.match(ci, /npm test/);
  assert.match(ci, /docker build|build/i);
});

test("[US-10] ADMIN khoa tai khoan -> dang nhap bi chan; mo khoa -> dang nhap lai duoc", async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const locked = await request(app).put(`/users/${customer._id}`).set(auth).send({ status: "LOCKED" });
  assert.equal(locked.body.data.status, "LOCKED");

  const blocked = await request(app).post("/auth/login").send({ emailOrPhone: customer.email, password: PASSWORD });
  assert.equal(blocked.body.error.code, "ACCOUNT_LOCKED");
  assert.match(blocked.body.error.message, /quản trị viên khóa/);

  await request(app).put(`/users/${customer._id}`).set(auth).send({ status: "ACTIVE" });
  const ok = await request(app).post("/auth/login").send({ emailOrPhone: customer.email, password: PASSWORD });
  assert.equal(ok.status, 200);
});

test("[US-10] ADMIN doi vai tro tai khoan", async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const res = await request(app).put(`/users/${hubStaff._id}`).set(auth).send({ role: "SHIPPER" });
  assert.equal(res.body.data.role, "SHIPPER");
  await request(app).put(`/users/${hubStaff._id}`).set(auth).send({ role: "HUB_STAFF" });
});

test("[US-10] Khong co API xoa tai khoan (tranh mo coi don hang tham chieu)", async () => {
  const res = await request(app).delete(`/users/${customer._id}`).set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 404);
  assert.ok(await User.exists({ _id: customer._id }));
});

test("[US-11] Sua mien va xoa khu vuc phuc vu", async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const route = await Route.findOne({ code: "R-HN-NOI" });
  const created = await request(app)
    .post("/serviceAreas")
    .set(auth)
    .send({ province: "Tỉnh Story", district: "Quận Story", region: "BAC", routeId: String(route._id) });
  assert.equal(created.status, 201);

  const updated = await request(app).put(`/serviceAreas/${created.body.data._id}`).set(auth).send({ region: "TRUNG" });
  assert.equal(updated.body.data.region, "TRUNG");

  const removed = await request(app).delete(`/serviceAreas/${created.body.data._id}`).set(auth);
  assert.equal(removed.status, 200);
  assert.equal(await ServiceArea.countDocuments({ province: "Tỉnh Story" }), 0);
});

test("[US-12] Co dung hai loai dich vu: gui thuong (khong phu phi) va gui nhanh", async () => {
  const types = await ServiceType.find().lean();
  const byCode = Object.fromEntries(types.map((t) => [t.code, t]));
  assert.deepEqual(Object.keys(byCode).sort(), ["EXPRESS", "STANDARD"]);
  assert.equal(byCode.STANDARD.surchargeRate, 0);
  assert.ok(byCode.EXPRESS.surchargeRate > 0);
});

test("[US-12] Tu choi ma dich vu la va he so phu phi am", async () => {
  const auth = { Authorization: `Bearer ${adminToken}` };
  const badCode = await request(app)
    .post("/serviceTypes")
    .set(auth)
    .send({ code: "SIEU_TOC", name: "X", surchargeRate: 1, estimatedDays: 1 });
  assert.equal(badCode.status, 400);
  const negative = await request(app)
    .put(`/serviceTypes/${(await ServiceType.findOne({ code: "EXPRESS" }))._id}`)
    .set(auth)
    .send({ surchargeRate: -1 });
  assert.equal(negative.status, 400);
});
