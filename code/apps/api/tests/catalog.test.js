import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Hub } from "../src/models/Hub.js";
import { Route } from "../src/models/Route.js";
import { ServiceArea } from "../src/models/ServiceArea.js";
import { ServiceType } from "../src/models/ServiceType.js";
import { PriceTable } from "../src/models/PriceTable.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";
const PASSWORD = "Test@12345";

let app;
let admin;
let customer;
let adminToken;
let customerToken;
let hub;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  admin = await User.create({
    email: "catalog-admin@edms.vn",
    phone: "0909993001",
    passwordHash,
    fullName: "Catalog Admin",
    role: "ADMIN",
    status: "ACTIVE",
  });
  customer = await User.create({
    email: "catalog-customer@edms.vn",
    phone: "0909993002",
    passwordHash,
    fullName: "Catalog Customer",
    role: "CUSTOMER",
    status: "ACTIVE",
    customerType: "INDIVIDUAL",
  });
  hub = await Hub.create({
    code: "HUB-TEST-CATALOG",
    name: "Hub Test Catalog",
    type: "HUB",
    province: "Ha Noi",
    district: "Hoan Kiem",
    isActive: true,
  });

  const adminLogin = await request(app).post("/auth/login").send({ emailOrPhone: admin.email, password: PASSWORD });
  adminToken = adminLogin.body.data.accessToken;
  const customerLogin = await request(app)
    .post("/auth/login")
    .send({ emailOrPhone: customer.email, password: PASSWORD });
  customerToken = customerLogin.body.data.accessToken;
});

after(async () => {
  await Promise.all([
    User.deleteMany({ _id: { $in: [admin._id, customer._id] } }),
    Hub.deleteOne({ _id: hub._id }),
  ]);
  await getRedis().quit();
  await mongoose.disconnect();
});

test("CUSTOMER bi FORBIDDEN khi goi API quan tri danh muc", async () => {
  const res = await request(app).get("/routes").set("Authorization", `Bearer ${customerToken}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, "FORBIDDEN");
});

test("khong co token bi UNAUTHORIZED", async () => {
  const res = await request(app).get("/routes");
  assert.equal(res.status, 401);
});

let routeId;
test("ADMIN CRUD tuyen (routes)", async () => {
  const createRes = await request(app)
    .post("/routes")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ code: "R-TEST-1", name: "Tuyen test", hubId: hub._id, maxPickupPerShift: 10, maxDeliveryPerShift: 10 });
  assert.equal(createRes.status, 201);
  routeId = createRes.body.data._id;

  const listRes = await request(app).get("/routes").set("Authorization", `Bearer ${adminToken}`);
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.meta.total >= 1);

  const updateRes = await request(app)
    .put(`/routes/${routeId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ maxPickupPerShift: 20 });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.maxPickupPerShift, 20);
});

test("mot quan/huyen chi thuoc mot tuyen - tao trung bi CONFLICT", async () => {
  const first = await request(app)
    .post("/serviceAreas")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ province: "TestProvince", district: "TestDistrict", region: "BAC", routeId });
  assert.equal(first.status, 201);

  const dup = await request(app)
    .post("/serviceAreas")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ province: "TestProvince", district: "TestDistrict", region: "BAC", routeId });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "CONFLICT");

  await ServiceArea.deleteMany({ province: "TestProvince", district: "TestDistrict" });
  await Route.deleteOne({ _id: routeId });
});

test("ADMIN CRUD nguoi dung, mat khau duoc hash va khong lo passwordHash", async () => {
  // Don truoc neu lan chay/test fail truoc do bo lai (tranh 409 gia do du lieu mo).
  await User.deleteOne({ email: "catalog-created-shipper@edms.vn" });

  const createRes = await request(app)
    .post("/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email: "catalog-created-shipper@edms.vn",
      phone: "0909993003",
      password: "ShipperPass@1",
      fullName: "Shipper Moi",
      role: "SHIPPER",
    });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.data.passwordHash, undefined);

  const userId = createRes.body.data._id;

  const getRes = await request(app).get(`/users/${userId}`).set("Authorization", `Bearer ${adminToken}`);
  assert.equal(getRes.body.data.passwordHash, undefined);

  const lockRes = await request(app)
    .put(`/users/${userId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status: "LOCKED" });
  assert.equal(lockRes.status, 200);
  assert.equal(lockRes.body.data.status, "LOCKED");

  const deleteRes = await request(app).delete(`/users/${userId}`).set("Authorization", `Bearer ${adminToken}`);
  assert.equal(deleteRes.status, 404, "users khong co route DELETE");

  await User.deleteOne({ _id: userId });
});

test("serviceTypes: khong xoa duoc khi da dung trong bang gia", async () => {
  // code bi gioi han boi enum STANDARD|EXPRESS va co unique index, nen tai
  // su dung ban ghi co san (tu seed) neu da ton tai thay vi tao moi bi trung.
  let serviceType = await ServiceType.findOne({ code: "STANDARD" });
  let createdServiceType = false;
  if (!serviceType) {
    serviceType = await ServiceType.create({
      code: "STANDARD",
      name: "Giao hang tieu chuan",
      surchargeRate: 0,
      estimatedDays: 3,
      isActive: true,
    });
    createdServiceType = true;
  }

  const priceTable = await PriceTable.create({
    serviceTypeId: serviceType._id,
    zone: "INNER_DISTRICT",
    weightTiers: [{ fromGram: 0, toGram: 999999999, basePrice: 10000, pricePer500g: 1000 }],
    effectiveFrom: new Date(),
    isActive: true,
  });

  const res = await request(app)
    .delete(`/serviceTypes/${serviceType._id}`)
    .set("Authorization", `Bearer ${adminToken}`);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "CONFLICT");

  await PriceTable.deleteOne({ _id: priceTable._id });
  if (createdServiceType) await ServiceType.deleteOne({ _id: serviceType._id });
});
