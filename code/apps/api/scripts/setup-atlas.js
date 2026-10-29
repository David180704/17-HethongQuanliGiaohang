// Noi API voi MongoDB Atlas: dan chuoi ket noi -> chuan hoa -> THU KET NOI THAT -> ghi .env.
//   npm run atlas:setup                  (hoi chuoi ket noi, go an - khong hien len man hinh)
//   npm run atlas:setup -- "<chuoi>"     (truyen thang)
// Khong bao gio in mat khau. Chi ghi .env khi ket noi thanh cong. .env da nam trong .gitignore.
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath, URL } from "node:url";
import mongoose from "mongoose";
import { ensureSrvDns } from "../src/config/db.js";
import { normalizeMongoUri, upsertEnvValue } from "../src/config/mongoUri.js";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const examplePath = fileURLToPath(new URL("../.env.example", import.meta.url));

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    let muted = true;
    // Khong in lai ky tu go/dan: chuoi ket noi co mat khau
    rl._writeToOutput = (text) => {
      if (!muted) process.stdout.write(text);
    };
    rl.question("", (answer) => {
      muted = false;
      rl.close();
      process.stdout.write(`\n(da nhan ${answer.trim().length} ky tu)\n`);
      resolve(answer);
    });
  });
}

// Doi loi cua driver sang huong dan cu the. Xoa moi dau vet mat khau trong thong bao goc.
function explain(err, password) {
  const msg = String(err?.message || err)
    .split(password)
    .join("***")
    .split(encodeURIComponent(password))
    .join("***");
  if (/ENOTFOUND|querySrv|ENODATA|EREFUSED/i.test(msg)) {
    return `Không tìm thấy địa chỉ cluster. Kiểm tra lại phần sau dấu @ (copy đúng từ nút Connect), hoặc mạng/DNS.\n  Chi tiết: ${msg}`;
  }
  if (/bad auth|authentication failed|AuthenticationFailed/i.test(msg)) {
    return "Sai tên đăng nhập hoặc mật khẩu. Đây là user CSDL tạo ở Database Access (vd edms_app), KHÔNG phải tài khoản đăng nhập trang Atlas. Quên mật khẩu: Database Access → Edit → Edit Password.";
  }
  if (/Server selection timed out|Could not connect to any servers|ECONNREFUSED|ETIMEDOUT|whitelist|not authorized to access/i.test(msg)) {
    return "Không vào được cluster: thường do IP máy bạn chưa có trong Network Access. Atlas → Network Access → Add IP Address → Add Current IP Address, đợi 1 phút rồi chạy lại.\n  Mạng trường/công ty có thể chặn cổng 27017: thử 4G.";
  }
  return `Kết nối thất bại: ${msg}`;
}

async function main() {
  const input = process.argv[2] ?? (await askHidden("Dan chuoi ket noi Atlas (mongodb+srv://...) roi Enter: "));

  let parsed;
  try {
    parsed = normalizeMongoUri(input);
  } catch (err) {
    console.error(`\nLOI: ${err.message}`);
    process.exit(1);
  }
  const password = decodeURIComponent(parsed.uri.match(/^[^:]+:\/\/[^:]+:([^@]*)@/)[1]);
  for (const change of parsed.changes) console.log(`- Da tu dong ${change}`);

  console.log(`\nDang thu ket noi ${parsed.host}/${parsed.dbName} (toi da 15 giay)...`);
  await ensureSrvDns(parsed.uri);
  const conn = mongoose.createConnection(parsed.uri, { serverSelectionTimeoutMS: 15000, appName: "edms-setup" });
  try {
    await conn.asPromise();
    await conn.db.admin().ping();
    const collections = await conn.db.listCollections({}, { nameOnly: true }).toArray();
    const counts = {};
    for (const name of ["users", "orders", "serviceareas", "pricetables"]) {
      if (collections.some((c) => c.name === name)) counts[name] = await conn.db.collection(name).countDocuments();
    }
    console.log("Ket noi THANH CONG.");
    console.log(
      collections.length === 0
        ? `Database "${parsed.dbName}" dang trong.`
        : `Database "${parsed.dbName}" co ${collections.length} collection: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ") || "(khong phai du lieu EDMS)"}`,
    );

    if (!existsSync(envPath)) copyFileSync(examplePath, envPath);
    writeFileSync(envPath, upsertEnvValue(readFileSync(envPath, "utf8"), "MONGO_URI", parsed.uri), "utf8");
    console.log(`\nDa ghi MONGO_URI vao ${envPath} (file nay KHONG len Git).`);
    console.log("Buoc tiep:");
    console.log("  npm run seed -- --yes   # do du lieu mau len cloud (XOA SACH du lieu cu tren database nay)");
    console.log("  npm run dev             # roi mo http://localhost:4044/health, thay \"cloud\": true");
    console.log("Quay lai CSDL local: sua MONGO_URI trong .env thanh mongodb://localhost:27018/edms?directConnection=true");
  } catch (err) {
    console.error(`\nLOI: ${explain(err, password)}`);
    console.error("Chua ghi gi vao .env.");
    process.exitCode = 1;
  } finally {
    await conn.close().catch(() => {});
  }
}

main();
