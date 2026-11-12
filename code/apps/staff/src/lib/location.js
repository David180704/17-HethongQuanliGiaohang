import AsyncStorage from "@react-native-async-storage/async-storage";

// Vi tri GIA LAP cua tai xe (khong co giao hang / dinh vi that - CLAUDE.md muc 8): tai xe chon "dang o" mot diem
// check-in hoac nhap toa do; tren may ao co the dat bang `adb emu geo fix` roi nhap lai. Dung chung cho xac nhan
// lay hang (US-28) va check-in tu dong (US-30). Luu AsyncStorage de mo lai app van con.
const KEY = "edms.simulatedPosition";
// Mac dinh: Hub Ha Noi (quan Hoan Kiem)
export const DEFAULT_POSITION = { lat: 21.0285, lng: 105.8542, label: "Hub Hà Nội (mặc định)" };

let current = DEFAULT_POSITION;
let loaded = false;
const listeners = new Set();

export async function loadPosition() {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_POSITION, ...JSON.parse(raw) };
  } catch {
    // khong doc duoc bo nho -> dung mac dinh
  }
  return current;
}

export function getPosition() {
  return current;
}

export async function setPosition({ lat, lng, label }) {
  current = { lat: Number(lat), lng: Number(lng), label: label || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` };
  loaded = true;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // bo qua: van dung trong phien
  }
  listeners.forEach((listener) => listener(current));
  return current;
}

export function onPositionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const formatPosition = (p) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
