// Mo khoa tai khoan test: xoa khoa dang nhap 15 phut (dem sai mat khau tren Redis) va
// tra ve ACTIVE nhung tai khoan test dang LOCKED (vd test lien thiet bi bi ngat giua chung).
//   npm run unlock                       # CSDL theo .env (Atlas neu da noi)
//   npm run unlock -- --local            # CSDL local (Docker)
//   npm run unlock -- --reset-password   # dat lai mat khau test ve 123456
// shop4 giu PENDING (tai khoan cho duyet, dung thiet ke).
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDB, disconnectDB, describeUri, LOCAL_MONGO_URI } from "../src/config/db.js";
import { getRedis } from "../src/config/redis.js";
import { TEST_PASSWORD } from "../src/seed/testAccounts.js";

const args = process.argv.slice(2);
const uri = args.includes("--local") ? LOCAL_MONGO_URI : env.mongoUri;
const TEST_EMAILS = [
  "admin@edms.vn",
  ...[1, 2, 3].map((i) => `kho${i}@edms.vn`),
  ...[1, 2, 3, 4, 5].map((i) => `taixe${i}@edms.vn`),
  ...[1, 2, 3, 4, 5, 6].map((i) => `khach${i}@edms.vn`),
  ...[1, 2, 3].map((i) => `shop${i}@edms.vn`),
];

const redis = getRedis();
let removed = 0;
let cursor = "0";
do {
  const [next, keys] = await redis.scan(cursor, "MATCH", "login:*", "COUNT", 200);
  cursor = next;
  if (keys.length) removed += await redis.del(...keys);
} while (cursor !== "0");
console.log(`Redis: da xoa ${removed} khoa/bo dem dang nhap sai`);

await connectDB(uri);
console.log(`CSDL: ${describeUri(uri)}`);
const users = mongoose.connection.collection("users");
const unlocked = await users.updateMany({ email: { $in: TEST_EMAILS }, status: "LOCKED" }, { $set: { status: "ACTIVE" } });
console.log(`Mo lai ${unlocked.modifiedCount} tai khoan test dang LOCKED`);
if (args.includes("--reset-password")) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const reset = await users.updateMany({ email: { $in: TEST_EMAILS } }, { $set: { passwordHash } });
  console.log(`Dat lai mat khau ${TEST_PASSWORD} cho ${reset.modifiedCount} tai khoan test`);
}
await disconnectDB();
await redis.quit();
