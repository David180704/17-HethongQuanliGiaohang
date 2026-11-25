// US-45: du lieu tren cloud (Atlas M0 khong co sao luu tu dong) -> sao luu ra JSON va khoi phuc dung nguyen ban.
// Dung CSDL rieng edms_backup_test tren Docker local, khong dung toi CSDL edms cua cac test khac.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import mongoose from "mongoose";
import { backupDatabase, backupFolderName, restoreDatabase } from "../scripts/lib/backup.js";
import { isLocalUri } from "../src/config/db.js";

const URI = "mongodb://localhost:27018/edms_backup_test?directConnection=true";
let conn;
let tmp;

before(async () => {
  conn = await mongoose.createConnection(URI).asPromise();
  await conn.db.dropDatabase();
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "edms-backup-"));
});

after(async () => {
  try {
    await conn.db.dropDatabase();
    await fs.rm(tmp, { recursive: true, force: true });
  } finally {
    await conn.close();
  }
});

test("[US-45] sao luu CSDL ra JSON roi khoi phuc: dung so ban ghi, giu ObjectId, ngay gio, so tien", async () => {
  const { ObjectId, Decimal128 } = mongoose.mongo;
  const orderId = new ObjectId();
  const createdAt = new Date("2026-11-20T08:30:00.000Z");
  await conn.db.collection("orders").insertMany([
    { _id: orderId, trackingCode: "EXP1000000001", createdAt, fee: { total: 32000 }, rate: Decimal128.fromString("0.5") },
    { trackingCode: "EXP1000000002", receiver: { name: "Nguyễn Văn Á" } },
  ]);
  await conn.db.collection("users").insertOne({ email: "a@edms.vn" });

  const dir = path.join(tmp, backupFolderName(new Date("2026-11-25T09:05:07"), "edms-local"));
  assert.match(path.basename(dir), /^edms-local-20261125-090507$/);
  const manifest = await backupDatabase(conn.db, dir, { source: "localhost/edms_backup_test" });
  assert.deepEqual(manifest.counts, { orders: 2, users: 1 });

  // su co: mat du lieu -> khoi phuc tu ban sao
  await conn.db.collection("orders").deleteMany({});
  await conn.db.collection("users").insertOne({ email: "rac@edms.vn" });
  const { restored } = await restoreDatabase(conn.db, dir);
  assert.deepEqual(restored, { orders: 2, users: 1 });

  const back = await conn.db.collection("orders").findOne({ _id: orderId });
  assert.ok(back, "giu nguyen _id kieu ObjectId");
  assert.ok(back.createdAt instanceof Date);
  assert.equal(back.createdAt.toISOString(), createdAt.toISOString());
  assert.equal(back.rate.toString(), "0.5");
  assert.equal(await conn.db.collection("users").countDocuments({ email: "rac@edms.vn" }), 0, "ghi de du lieu sau su co");
  assert.equal((await conn.db.collection("orders").findOne({ trackingCode: "EXP1000000002" })).receiver.name, "Nguyễn Văn Á");
});

test("[US-45] khoi phuc chi mac dinh vao CSDL local; CSDL cloud phai xac nhan rieng; ban sao khong vao git", () => {
  assert.equal(isLocalUri(URI), true);
  assert.equal(isLocalUri("mongodb+srv://edms:x@cluster0.abcde.mongodb.net/edms"), false);
  const script = readFileSync(fileURLToPath(new URL("../scripts/backup-db.js", import.meta.url)), "utf8");
  assert.match(script, /--cho-phep-cloud/);
  assert.match(script, /--yes/);
  const gitignore = readFileSync(fileURLToPath(new URL("../../../../.gitignore", import.meta.url)), "utf8");
  assert.match(gitignore, /code\/apps\/api\/backups\//);
  const workflow = readFileSync(fileURLToPath(new URL("../../../../.github/workflows/backup.yml", import.meta.url)), "utf8");
  assert.match(workflow, /schedule:/, "sao luu dinh ky");
  assert.match(workflow, /secrets\.BACKUP_MONGO_URI/, "chuoi ket noi lay tu GitHub Secrets");
  assert.match(workflow, /upload-artifact/, "ban sao luu tren GitHub (cloud thu hai)");
});
