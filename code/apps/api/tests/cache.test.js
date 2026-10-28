import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "../src/app.js";
import { removeLeftovers } from "./helpers/fixtures.js";
import { User } from "../src/models/User.js";
import { Route } from "../src/models/Route.js";
import { ServiceArea } from "../src/models/ServiceArea.js";
import { getRedis } from "../src/config/redis.js";
import { CacheService } from "../src/infrastructure/cache/CacheService.js";
import { MemoryCacheStore } from "../src/infrastructure/cache/MemoryCacheStore.js";
import { CachedRepository } from "../src/core/CachedRepository.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";
const PASSWORD = "Test@12345";
const PROVINCE = "Tỉnh Kiểm Thử Cache";

// ---------- Unit test: khong can MongoDB/Redis ----------

describe("CacheService (kho bo nho)", () => {
  test("[CACHE] lan dau MISS goi loader, lan sau HIT khong goi loader", async () => {
    const cache = new CacheService({ store: new MemoryCacheStore(), defaultTtlSeconds: 30 });
    let calls = 0;
    const loader = async () => ({ n: ++calls });

    const first = await cache.getOrSet("x", ["a"], loader);
    const second = await cache.getOrSet("x", ["a"], loader);
    assert.deepEqual([first.hit, second.hit], [false, true]);
    assert.equal(calls, 1);
    assert.deepEqual(second.value, { n: 1 });
  });

  test("[CACHE] invalidate(scope) xoa ca vung -> lan doc sau lai goi loader", async () => {
    const cache = new CacheService({ store: new MemoryCacheStore() });
    let calls = 0;
    await cache.getOrSet("x", ["a"], async () => ++calls);
    await cache.invalidate("x");
    const after = await cache.getOrSet("x", ["a"], async () => ++calls);
    assert.equal(after.hit, false);
    assert.equal(calls, 2);
  });

  test("[CACHE] tham so cung noi dung khac thu tu khoa dung chung mot khoa cache", async () => {
    const cache = new CacheService({ store: new MemoryCacheStore() });
    await cache.getOrSet("x", [{ page: 1, search: "a" }], async () => "v");
    const again = await cache.getOrSet("x", [{ search: "a", page: 1 }], async () => "khac");
    assert.equal(again.hit, true);
  });

  test("[CACHE] TTL = 0 tat cache: luon goi loader", async () => {
    const cache = new CacheService({ store: new MemoryCacheStore(), defaultTtlSeconds: 0 });
    let calls = 0;
    await cache.getOrSet("x", ["a"], async () => ++calls);
    await cache.getOrSet("x", ["a"], async () => ++calls);
    assert.equal(calls, 2);
  });

  test("[CACHE] kho cache loi (Redis chet) -> van tra du lieu tu nguon, khong nem loi", async () => {
    const brokenStore = {
      get: async () => {
        throw new Error("ECONNREFUSED");
      },
      set: async () => {
        throw new Error("ECONNREFUSED");
      },
      incr: async () => {
        throw new Error("ECONNREFUSED");
      },
    };
    const cache = new CacheService({ store: brokenStore });
    const result = await cache.getOrSet("x", ["a"], async () => "du lieu that");
    assert.deepEqual(result, { value: "du lieu that", hit: false });
  });
});

describe("CachedRepository (Decorator)", () => {
  function fakeRepository() {
    const calls = { findPage: 0 };
    return {
      calls,
      findPage: async () => ({ items: [{ n: ++calls.findPage }], total: 1 }),
      create: async (data) => data,
    };
  }

  test("[CACHE] doc 2 lan chi cham repository goc 1 lan; ghi xong thi doc lai tu nguon", async () => {
    const inner = fakeRepository();
    const repo = new CachedRepository(inner, { cache: new CacheService({ store: new MemoryCacheStore() }), scope: "t" });

    await repo.findPage({ page: 1 });
    await repo.findPage({ page: 1 });
    assert.equal(inner.calls.findPage, 1, "lan doc thu 2 phai lay tu cache");

    await repo.create({ ten: "moi" });
    await repo.findPage({ page: 1 });
    assert.equal(inner.calls.findPage, 2, "ghi xong phai xoa cache");
  });
});

// ---------- Tich hop qua HTTP: MongoDB + Redis that ----------

describe("Cache trang cong khai qua HTTP", () => {
  let app;
  let admin;
  let adminToken;
  let route;

  before(async () => {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
    await removeLeftovers({ emails: ["cache-admin@edms.vn"] });
    app = createApp();
    await ServiceArea.deleteMany({ province: PROVINCE });
    route = await Route.findOne();
    admin = await User.create({
      email: "cache-admin@edms.vn",
      phone: "0909995001",
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      fullName: "Cache Admin",
      role: "ADMIN",
      status: "ACTIVE",
    });
    const login = await request(app).post("/auth/login").send({ emailOrPhone: admin.email, password: PASSWORD });
    adminToken = login.body.data.accessToken;
  });

  after(async () => {
    await ServiceArea.deleteMany({ province: PROVINCE });
    await User.deleteOne({ _id: admin._id });
    await getRedis().quit();
    await mongoose.disconnect();
  });

  test("[CACHE] goi 2 lan: lan sau X-Cache HIT (khong truy van MongoDB)", async () => {
    const search = `cache-${Date.now()}`;
    const first = await request(app).get("/public/service-areas").query({ search });
    const second = await request(app).get("/public/service-areas").query({ search });
    assert.equal(first.headers["x-cache"], "MISS");
    assert.equal(second.headers["x-cache"], "HIT");
    assert.deepEqual(second.body.data, first.body.data);
  });

  test("[CACHE] admin them khu vuc -> cache trang cong khai bi xoa ngay (EventBus), khach thay du lieu moi", async () => {
    const district = `Quận Cache ${Date.now()}`;
    const before = await request(app).get("/public/service-areas").query({ search: PROVINCE });
    assert.equal(before.body.data.length, 0);
    await request(app).get("/public/service-areas").query({ search: PROVINCE }); // nap cache

    const created = await request(app)
      .post("/serviceAreas")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ province: PROVINCE, district, region: "BAC", routeId: String(route._id) });
    assert.equal(created.status, 201);

    const after = await request(app).get("/public/service-areas").query({ search: PROVINCE });
    assert.equal(after.headers["x-cache"], "MISS", "ghi xong phai xoa cache, khong tra ban cu");
    assert.equal(after.body.data.length, 1);
    assert.equal(after.body.data[0].district, district);
  });
});
