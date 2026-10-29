import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = process.env.EXPO_PUBLIC_API_PORT || "4044";

// Thu tu uu tien khi tim dia chi API:
// 1. EXPO_PUBLIC_API_URL trong .env (API o may khac, hoac ban deploy that)
// 2. Web: cung hostname voi trang dang mo - mo bang IP LAN thi API cung theo IP LAN
// 3. Dien thoai chay Expo Go: lay IP may dev tu hostUri ("192.168.1.10:8082").
//    Tren dien thoai "localhost" la chinh cai dien thoai, khong phai may dev.
// 4. localhost
function resolveApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (devHost) return `http://${devHost}:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

// Vai tro duoc dung App Nhan vien - server cung chan (POST /auth/login app=STAFF).
export const STAFF_ROLES = ["ADMIN", "HUB_STAFF", "SHIPPER"];
