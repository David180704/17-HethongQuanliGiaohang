import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

const URI = "mongodb://localhost:27017/edms?directConnection=true";

before(() => mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 }));
after(() => mongoose.disconnect());

test("MongoDB chay o che do replica set", async () => {
  const info = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(info.setName, "rs0");
  console.log("   replica set =", info.setName, "| primary =", info.primary);
});

test("Ghi nhieu document trong mot transaction", async () => {
  const col = mongoose.connection.collection("tx_probe");
  await col.deleteMany({});
  const s = await mongoose.startSession();
  await s.withTransaction(async () => {
    await col.insertOne({ buoc: 1 }, { session: s });
    await col.insertOne({ buoc: 2 }, { session: s });
  });
  await s.endSession();
  assert.equal(await col.countDocuments(), 2);
  await col.drop();
});

test("Transaction tu huy khi co loi giua chung", async () => {
  const col = mongoose.connection.collection("tx_probe");
  await col.deleteMany({});
  const s = await mongoose.startSession();
  try {
    await s.withTransaction(async () => {
      await col.insertOne({ buoc: 1 }, { session: s });
      throw new Error("Loi gia lap");
    });
  } catch {}
  await s.endSession();
  assert.equal(await col.countDocuments(), 0);
});