import mongoose from "mongoose";
import { env } from "./env.js";

// CSDL local (Docker) dung cho test; CSDL that co the la MongoDB Atlas (cloud).
export const LOCAL_MONGO_URI = "mongodb://localhost:27017/edms?directConnection=true";

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

export async function connectDB(uri = env.mongoUri) {
  mongoose.set("strictQuery", true);
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
