import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ServiceType } from "../src/models/ServiceType.js";
import { PriceTable } from "../src/models/PriceTable.js";
import { getContainer } from "../src/container.js";
import { getRedis } from "../src/config/redis.js";

// Hoi theo thoi diem cu the -> service doc thang DB (khong qua cache)
const listActivePriceTables = async (at) => (await getContainer().publicCatalogService.listActivePriceTables({ at })).value;

const URI = "mongodb://localhost:27017/edms?directConnection=true";
const TIERS = [{ fromGram: 0, toGram: 999999999, basePrice: 1000, pricePer500g: 0 }];

let app;
let serviceType;
let expiredTable;
let futureTable;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();
  serviceType = await ServiceType.findOne({ code: "STANDARD" });
  expiredTable = await PriceTable.create({
    serviceTypeId: serviceType._id,
    zone: "INNER_DISTRICT",
    weightTiers: TIERS,
    effectiveFrom: new Date("2020-01-01"),
    effectiveTo: new Date("2020-12-31"),
  });
  futureTable = await PriceTable.create({
    serviceTypeId: serviceType._id,
    zone: "INNER_DISTRICT",
    weightTiers: TIERS,
    effectiveFrom: new Date("2099-01-01"),
  });
});

after(async () => {
  await PriceTable.deleteMany({ _id: { $in: [expiredTable._id, futureTable._id] } });
  await getRedis().quit();
  await mongoose.disconnect();
});

test("[PB-01] GET /public/service-types khong can token, khong lo field noi bo", async () => {
  const res = await request(app).get("/public/service-types");
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 2);
  const item = res.body.data[0];
  assert.ok(item.code && item.name);
  assert.equal(item.createdAt, undefined);
});

test("[PB-01] GET /public/service-areas tim theo ten quan, khong lo routeId", async () => {
  const res = await request(app).get("/public/service-areas").query({ search: "Hoàn Kiếm" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].province, "Hà Nội");
  assert.equal(res.body.data[0].routeId, undefined);
});

test("[PB-01] GET /public/service-areas: ky tu dac biet trong search khong lam vo regex", async () => {
  const res = await request(app).get("/public/service-areas").query({ search: "(((" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 0);
});

test("[PB-04] GET /public/price-tables chi tra bang gia dang hieu luc", async () => {
  const res = await request(app).get("/public/price-tables");
  assert.equal(res.status, 200);
  const ids = res.body.data.map((t) => t._id);
  assert.ok(!ids.includes(String(expiredTable._id)), "bang gia het han khong duoc hien");
  assert.ok(!ids.includes(String(futureTable._id)), "bang gia chua toi ngay khong duoc hien");
  assert.ok(res.body.data[0].serviceTypeId.code, "phai kem thong tin loai dich vu");
});

test("[PB-04] listActivePriceTables: dung tai thoi diem effectiveTo thi het hieu luc", async () => {
  const tables = await listActivePriceTables(new Date("2020-12-31"));
  assert.ok(!tables.some((t) => String(t._id) === String(expiredTable._id)));
  const before = await listActivePriceTables(new Date("2020-12-30"));
  assert.ok(before.some((t) => String(t._id) === String(expiredTable._id)));
});
