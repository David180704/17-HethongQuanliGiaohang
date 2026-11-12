// File mongosh khoi tao CSDL (code/database) phai khop voi model Mongoose hien tai.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { buildStructure, renderStructureScript } from "../scripts/lib/mongoshStructure.js";

const structureFile = fileURLToPath(new URL("../../../database/01-tao-cau-truc.mongodb.js", import.meta.url));

test("[US-02] 01-tao-cau-truc.mongodb.js khop voi model (sua model thi chay npm run db:export)", () => {
  const committed = readFileSync(structureFile, "utf8").replace(/\r\n/g, "\n");
  assert.equal(committed, renderStructureScript(), "File cu: chay `npm run db:export` trong code/apps/api");
});

// 12 collection nghiep vu ban dau + checkinPoints, checkinLogs (Sprint 5, US-29, US-30) + incidents, settlements (Sprint 7, US-38, US-34)
test("[US-02] Cau truc sinh ra co du 16 collection va 4 chi muc bat buoc", () => {
  const byName = Object.fromEntries(buildStructure().map((c) => [c.name, c]));
  assert.equal(Object.keys(byName).length, 16);
  const has = (name, keys, opts = {}) =>
    byName[name].indexes.some(
      ([k, o]) => JSON.stringify(k) === JSON.stringify(keys) && Object.entries(opts).every(([key, v]) => o[key] === v),
    );
  assert.ok(has("orders", { trackingCode: 1 }, { unique: true }));
  assert.ok(has("orders", { customerId: 1, status: 1, createdAt: -1 }));
  assert.ok(has("assignments", { shipperId: 1, shiftDate: 1, status: 1 }));
  assert.ok(has("orderdrafts", { createdAt: 1 }, { expireAfterSeconds: 86400 }));
});

test("[US-02] Rang buoc CSDL mang dung quy tac nghiep vu (COD toi da 20 trieu, vai tro hop le)", () => {
  const byName = Object.fromEntries(buildStructure().map((c) => [c.name, c]));
  const cod = byName.orders.jsonSchema.properties.cod.properties.amount;
  assert.equal(cod.maximum, 20000000);
  assert.equal(cod.minimum, 0);
  assert.deepEqual(byName.users.jsonSchema.properties.role.enum, ["GUEST", "CUSTOMER", "SHIPPER", "HUB_STAFF", "ADMIN"]);
  assert.ok(byName.orders.jsonSchema.required.includes("trackingCode"));
});
