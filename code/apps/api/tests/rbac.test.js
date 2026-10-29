import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Role } from "../src/models/Role.js";
import { getContainer } from "../src/container.js";
import { createRequirePermission } from "../src/middleware/rbac.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";

const { permissionService, cache } = getContainer();
const requirePermission = createRequirePermission(permissionService);

let originalGuest;
let originalCustomer;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  originalGuest = await Role.findOne({ code: "GUEST" }).lean();
  originalCustomer = await Role.findOne({ code: "CUSTOMER" }).lean();

  await Role.updateOne(
    { code: "GUEST" },
    { $set: { permissions: ["order:track", "priceTable:read"], inheritsFrom: null } },
    { upsert: true },
  );
  await Role.updateOne(
    { code: "CUSTOMER" },
    { $set: { permissions: ["order:create"], inheritsFrom: "GUEST" } },
    { upsert: true },
  );
  await permissionService.invalidate();
});

after(async () => {
  if (originalGuest) {
    await Role.updateOne(
      { code: "GUEST" },
      { $set: { permissions: originalGuest.permissions, inheritsFrom: originalGuest.inheritsFrom } },
    );
  }
  if (originalCustomer) {
    await Role.updateOne(
      { code: "CUSTOMER" },
      { $set: { permissions: originalCustomer.permissions, inheritsFrom: originalCustomer.inheritsFrom } },
    );
  }
  await permissionService.invalidate();
  await getRedis().quit();
  await mongoose.disconnect();
});

test("[US-09] CUSTOMER ke thua toan bo quyen cua GUEST (duyet cay, khong so khop phang)", async () => {
  const permissions = await permissionService.resolve("CUSTOMER");
  assert.ok(permissions.includes("order:create"), "phai co quyen rieng cua CUSTOMER");
  assert.ok(permissions.includes("order:track"), "phai ke thua quyen order:track tu GUEST");
  assert.ok(permissions.includes("priceTable:read"), "phai ke thua quyen priceTable:read tu GUEST");
});

test("[US-09] GUEST khong co quyen rieng cua CUSTOMER", async () => {
  const permissions = await permissionService.resolve("GUEST");
  assert.ok(!permissions.includes("order:create"));
});

test("[US-09] Ket qua duyet cay duoc cache tren Redis", async () => {
  await permissionService.resolve("CUSTOMER");
  const cached = await cache.peek("permissions", ["CUSTOMER"]);
  assert.ok(cached, "phai co cache sau khi resolve");
  assert.ok(cached.includes("order:track"));
});

test("[US-09] Doi quyen GUEST thi CUSTOMER (vai tro ke thua) thay ngay, khong doi cache het han", async () => {
  await permissionService.resolve("CUSTOMER"); // nap cache truoc
  await Role.updateOne({ code: "GUEST" }, { $addToSet: { permissions: "tracking:view-map" } });
  await permissionService.invalidate();

  const permissions = await permissionService.resolve("CUSTOMER");
  assert.ok(permissions.includes("tracking:view-map"), "CUSTOMER phai thay quyen moi cua GUEST ngay");
});

test("[US-09] ADMIN voi quyen wildcard '*' duoc phep lam moi hanh dong", async () => {
  let calledWith;
  const req = { user: { role: "ADMIN" } };
  const next = (err) => (calledWith = err);

  await requirePermission("bat-ky-quyen-nao-chua-tung-khai-bao")(req, {}, next);

  assert.equal(calledWith, undefined, "next() phai duoc goi khong co loi");
});

test("[US-09] CUSTOMER khong co quyen rieng cua ADMIN bi FORBIDDEN", async () => {
  let calledWith;
  const req = { user: { role: "CUSTOMER" } };
  const next = (err) => (calledWith = err);

  await requirePermission("bat-ky-quyen-nao-chua-tung-khai-bao")(req, {}, next);

  assert.equal(calledWith?.code, "FORBIDDEN");
});
