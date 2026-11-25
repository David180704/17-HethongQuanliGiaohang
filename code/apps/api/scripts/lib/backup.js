// Sao luu / khoi phuc CSDL ra thu muc JSON (Extended JSON giu nguyen ObjectId, Date, Decimal...).
// Atlas goi mien phi (M0) khong co sao luu tu dong -> ban sao nay la lop bao ve thu hai (may dev, GitHub Actions).
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

const { EJSON } = mongoose.mongo.BSON;

export function backupFolderName(date = new Date(), label = "edms") {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  return `${label}-${stamp}`;
}

// Ghi moi collection mot file <ten>.json + manifest.json (thoi diem, so ban ghi tung collection).
export async function backupDatabase(db, outDir, { source = "" } = {}) {
  await fs.mkdir(outDir, { recursive: true });
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
  const counts = {};
  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    await fs.writeFile(path.join(outDir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }), "utf8");
    counts[name] = docs.length;
  }
  const manifest = { createdAt: new Date().toISOString(), source, database: db.databaseName, counts };
  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

// Khoi phuc: moi collection trong ban sao duoc xoa sach roi nap lai dung du lieu da sao luu.
export async function restoreDatabase(db, dir) {
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  const restored = {};
  for (const name of Object.keys(manifest.counts)) {
    const docs = EJSON.parse(await fs.readFile(path.join(dir, `${name}.json`), "utf8"), { relaxed: false });
    const collection = db.collection(name);
    await collection.deleteMany({});
    if (docs.length) await collection.insertMany(docs, { ordered: false, bypassDocumentValidation: true });
    restored[name] = docs.length;
  }
  return { manifest, restored };
}
