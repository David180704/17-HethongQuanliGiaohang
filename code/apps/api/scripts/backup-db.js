// Sao luu va khoi phuc CSDL (kiem soat rui ro khi du lieu nam tren cloud).
//   npm run backup                          # sao luu CSDL theo .env (Atlas) -> backups/edms-<thoi diem>/
//   npm run backup -- --local               # sao luu CSDL local (Docker)
//   npm run backup -- --out D:\SaoLuu\edms  # chon thu muc dich (vd thu muc dong bo Google Drive / OneDrive)
//   npm run restore -- backups/edms-... --local --yes          # khoi phuc vao CSDL local
//   npm run restore -- backups/edms-... --yes --cho-phep-cloud # khoi phuc vao CSDL cloud (ghi de!)
// Khong in chuoi ket noi (co mat khau); chi in ten may chu qua describeUri.
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDB, disconnectDB, describeUri, isLocalUri, LOCAL_MONGO_URI } from "../src/config/db.js";
import { backupDatabase, backupFolderName, restoreDatabase } from "./lib/backup.js";

const args = process.argv.slice(2);
const mode = args[0] === "restore" ? "restore" : "backup";
const rest = mode === "restore" ? args.slice(1) : args;
const flag = (name) => rest.includes(name);
const option = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const uri = flag("--local") ? LOCAL_MONGO_URI : process.env.BACKUP_MONGO_URI || env.mongoUri;
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Kiem dieu kien khoi phuc TRUOC khi ket noi: chua xac nhan thi khong cham toi CSDL nao.
if (mode === "restore") {
  const problem = !rest.find((a) => !a.startsWith("--"))
    ? "Thieu thu muc ban sao: npm run restore -- <thu muc> --local --yes"
    : !flag("--yes")
      ? "Khoi phuc se GHI DE du lieu hien co. Them --yes de xac nhan."
      : !isLocalUri(uri) && !flag("--cho-phep-cloud")
        ? `CSDL dich ${describeUri(uri)} la cloud. Them --cho-phep-cloud neu that su muon ghi de.`
        : null;
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
}

await connectDB(uri);
const db = mongoose.connection.db;
try {
  if (mode === "backup") {
    const label = isLocalUri(uri) ? "edms-local" : "edms";
    const outDir = path.resolve(option("--out") || path.join(apiRoot, "backups", backupFolderName(new Date(), label)));
    const manifest = await backupDatabase(db, outDir, { source: describeUri(uri) });
    const total = Object.values(manifest.counts).reduce((a, b) => a + b, 0);
    console.log(`Da sao luu ${describeUri(uri)}: ${Object.keys(manifest.counts).length} collection, ${total} ban ghi`);
    console.log(`Thu muc: ${outDir}`);
  } else {
    const dir = rest.find((a) => !a.startsWith("--"));
    const { restored } = await restoreDatabase(db, path.resolve(dir));
    const total = Object.values(restored).reduce((a, b) => a + b, 0);
    console.log(`Da khoi phuc vao ${describeUri(uri)}: ${Object.keys(restored).length} collection, ${total} ban ghi`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
