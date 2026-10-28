// Sinh code MongoDB (mongosh) de nguoi dung TU KHOI TAO CSDL EDMS tren Atlas/Compass:
//   code/database/01-tao-cau-truc.mongodb.js  <- tu model Mongoose (collection, rang buoc, chi muc)
//   code/database/02-du-lieu-mau.mongodb.js   <- tu bo seed (tai khoan test, danh muc, 200 don)
// Chay: cd code/apps/api && npm run db:export   (can Mongo local trong Docker)
// Seed vao database TAM "edms_export" tren may local roi xuat ra, xong thi xoa - khong dung
// toi database edms dang dung.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import mongoose from "mongoose";
const { EJSON } = mongoose.mongo.BSON;
import { buildStructure, renderStructureScript } from "./lib/mongoshStructure.js";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = fileURLToPath(new URL("../../../database/", import.meta.url));
const EXPORT_URI = "mongodb://localhost:27017/edms_export?directConnection=true";

mkdirSync(outDir, { recursive: true });
const structure = buildStructure();
writeFileSync(`${outDir}01-tao-cau-truc.mongodb.js`, renderStructureScript(structure), "utf8");
console.log("Da sinh 01-tao-cau-truc.mongodb.js");

console.log("Seed vao database tam edms_export...");
const seed = spawnSync(process.execPath, ["src/seed/index.js"], {
  cwd: apiRoot,
  env: { ...process.env, MONGO_URI: EXPORT_URI },
  encoding: "utf8",
});
if (seed.status !== 0) {
  console.error(seed.stdout, seed.stderr);
  process.exit(1);
}

const conn = await mongoose.createConnection(EXPORT_URI).asPromise();
try {
  const exportedAt = new Date();
  // Thu tu chen: danh muc truoc, du lieu tham chieu toi no sau (de doc file cho de hieu)
  const ORDER = ["roles", "hubs", "routes", "serviceareas", "servicetypes", "pricetables", "users", "shifts", "pickuplocations", "orders", "assignments", "orderdrafts"];
  const names = structure.map((c) => c.name).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const sections = [];
  const counts = {};
  for (const name of names) {
    const docs = await conn.db.collection(name).find({}).sort({ _id: 1 }).toArray();
    counts[name] = docs.length;
    const lines = docs.map((d) => `    ${EJSON.stringify(d, { relaxed: true })},`).join("\n");
    sections.push(`  ${JSON.stringify(name)}: [\n${lines}\n  ],`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const script = `// =============================================================================
// EDMS - BUOC 2: DU LIEU MAU (${total} ban ghi)
// =============================================================================
// FILE SINH TU DONG tu bo seed (code/apps/api/src/seed) bang lenh: npm run db:export
// Chay SAU 01-tao-cau-truc.mongodb.js. Xem docs/HuongDanKhoiTaoCSDL.md.
//
//   ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ")}
//   Tai khoan test, mat khau chung 123456: admin@edms.vn, kho1..3, taixe1..5,
//   khach1..6, shop1..4 @edms.vn (shop4 dang cho duyet)
//
// Ngay thang tu doi theo ngay chay: file xuat ngay ${exportedAt.toISOString().slice(0, 10)}, chay ngay khac thi
// moi moc thoi gian (don hang, bang gia, ca truc khi co) doi theo cung so ngay, de du lieu
// luon "moi" nhu vua tao.
//
// AN TOAN: database da co du lieu thi script DUNG LAI, khong xoa gi. Muon xoa de nap lai:
//   mongosh "<chuoi ket noi>" --eval "var XOA_DU_LIEU_CU=true" --file 02-du-lieu-mau.mongodb.js
// =============================================================================

const edms = db.getSiblingDB(typeof TEN_DB === "undefined" ? "edms" : TEN_DB);
const XOA = typeof XOA_DU_LIEU_CU !== "undefined" && XOA_DU_LIEU_CU === true;
const EXPORTED_AT = new Date(${JSON.stringify(exportedAt.toISOString())});

const DAY_MS = 86400000;
const dayOf = (d) => Math.floor(d.getTime() / DAY_MS);
const SHIFT_MS = (dayOf(new Date()) - dayOf(EXPORTED_AT)) * DAY_MS;
function shiftDates(value) {
  if (value instanceof Date) return new Date(value.getTime() + SHIFT_MS);
  if (Array.isArray(value)) return value.map(shiftDates);
  if (value && typeof value === "object" && value._bsontype === undefined) {
    for (const key of Object.keys(value)) value[key] = shiftDates(value[key]);
  }
  return value;
}

const DATA = {
${sections.join("\n")}
};

const names = Object.keys(DATA);
const coData = names.filter((n) => edms.getCollection(n).countDocuments({}, { limit: 1 }) > 0);
if (coData.length && !XOA) {
  throw new Error(
    \`Database "\${edms.getName()}" DA CO du lieu (\${coData.join(", ")}). Khong xoa gi.\\n\` +
      'Muon xoa sach de nap lai: them --eval "var XOA_DU_LIEU_CU=true" truoc --file',
  );
}
print(\`Database: \${edms.getName()} | doi ngay: \${SHIFT_MS / DAY_MS} ngay\\n\`);
for (const name of names) {
  const docs = DATA[name].map((d) => shiftDates(EJSON.deserialize(d)));
  // deleteMany (khong drop): giu nguyen rang buoc va chi muc da tao o buoc 1
  edms.getCollection(name).deleteMany({});
  if (docs.length) edms.getCollection(name).insertMany(docs);
  print(\`  \${name.padEnd(16)} \${docs.length}\`);
}
print("\\nXong. Dang nhap thu: admin@edms.vn / 123456 (App Nhan vien), khach1@edms.vn / 123456 (Web).");
`;
  writeFileSync(`${outDir}02-du-lieu-mau.mongodb.js`, script, "utf8");
  console.log(`Da sinh 02-du-lieu-mau.mongodb.js (${total} ban ghi)`);
} finally {
  await conn.dropDatabase();
  await conn.close();
}
