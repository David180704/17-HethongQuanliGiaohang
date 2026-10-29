import dns from "node:dns";
import { URL } from "node:url";
import mongoose from "mongoose";
import { env } from "./env.js";

// CSDL local (Docker) dung cho test; CSDL that co the la MongoDB Atlas (cloud).
export const LOCAL_MONGO_URI = "mongodb://localhost:27018/edms?directConnection=true";

export function isLocalUri(uri) {
  return /^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(uri);
}

// Chi in ten may chu, KHONG in tai khoan/mat khau nam trong chuoi ket noi.
export function describeUri(uri) {
  try {
    const { hostname, pathname } = new URL(uri);
    return `${hostname}${pathname}`;
  } catch {
    return "(chuoi ket noi khong doc duoc)";
  }
}

// Atlas dung chuoi "mongodb+srv://" -> driver tra ban ghi DNS SRV. Tren mot so may Windows,
// Node gui truy van SRV toi DNS 127.0.0.1 va bi tu choi (querySrv ECONNREFUSED) du trinh duyet
// van vao mang binh thuong (da gap trong moi truong chay cua Claude Code: Node thay DNS
// 127.0.0.1 thay vi DNS Wi-Fi cua may). Khi DNS TU CHOI/khong tra
// loi thi chuyen sang DNS cong cong; "khong ton tai" (ENOTFOUND) thi giu nguyen de bao dung loi.
export const FALLBACK_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];
const DNS_BROKEN = new Set(["ECONNREFUSED", "ETIMEOUT", "ESERVFAIL", "ECONNRESET", "EREFUSED"]);

/** @returns {Promise<boolean>} true neu da chuyen sang DNS cong cong */
export async function ensureSrvDns(uri, dnsModule = dns) {
  if (!String(uri).startsWith("mongodb+srv://")) return false;
  let host;
  try {
    host = new URL(uri).hostname;
  } catch {
    return false; // chuoi sai dang: de driver bao loi
  }
  try {
    await dnsModule.promises.resolveSrv(`_mongodb._tcp.${host}`);
    return false;
  } catch (err) {
    if (!DNS_BROKEN.has(err.code)) return false;
    dnsModule.setServers(FALLBACK_DNS_SERVERS);
    console.warn(`[db] DNS cua may khong tra loi truy van SRV (${err.code}) -> dung ${FALLBACK_DNS_SERVERS.join(", ")}`);
    return true;
  }
}

export async function connectDB(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
  await ensureSrvDns(uri);
  await mongoose.connect(uri, {
    // Cloud (Atlas) xa hon may local: cho phep cho lau hon khi chon may chu
    serverSelectionTimeoutMS: isLocalUri(uri) ? 5000 : 15000,
    appName: "edms-api",
  });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
