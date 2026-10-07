import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Role } from "../src/models/Role.js";
import { resolvePermissions, invalidatePermissionsCache } from "../src/middleware/rbac.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27017/edms?directConnection=true";

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

  await invalidatePermissionsCache("GUEST");
  await invalidatePermissionsCache("CUSTOMER");
});

after(async () => {
  if (originalGuest) {
    await Role.updateOne({ code: "GUEST" }, { $set: { permissions: originalGuest.permissions, inheritsFrom: originalGuest.inheritsFrom } });
  }
  if (originalCustomer) {
    await Role.updateOne({ code: "CUSTOMER" }, { $set: { permissions: originalCustomer.permissions, inheritsFrom: originalCustomer.inheritsFrom } });
  }
  await invalidatePermissionsCache("GUEST");
  await invalidatePermissionsCache("CUSTOMER");
  await getRedis().quit();
  await mongoose.disconnect();
});

test("CUSTOMER ke thua toan bo quyen cua GUEST (duyet cay, khong so khop phang)", async () => {
  const permissions = await resolvePermissions("CUSTOMER");
  assert.ok(permissions.includes("order:create"), "phai co quyen rieng cua CUSTOMER");
  assert.ok(permissions.includes("order:track"), "phai ke thua quyen order:track tu GUEST");
  assert.ok(permissions.includes("priceTable:read"), "phai ke thua quyen priceTable:read tu GUEST");
});

test("GUEST khong co quyen rieng cua CUSTOMER", async () => {
  const permissions = await resolvePermissions("GUEST");
  assert.ok(!permissions.includes("order:create"));
});

test("Ket qua duyet cay duoc cache tren Redis", async () => {
  await resolvePermissions("CUSTOMER");
  const cached = await getRedis().get("perm:CUSTOMER");
  assert.ok(cached, "phai co cache sau khi resolve");
  const parsed = JSON.parse(cached);
  assert.ok(parsed.includes("order:track"));
});
