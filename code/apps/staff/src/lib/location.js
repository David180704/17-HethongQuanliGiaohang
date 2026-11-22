import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

// Vi tri cua tai xe - dung cho xac nhan lay hang (US-28), giao hang (US-32) va check-in tu dong (US-30).
// Hai che do:
//   GPS        (mac dinh, tu 22/11/2026) GPS that cua dien thoai; ban Web Nhan vien dung dinh vi cua trinh duyet.
//              Theo doi lien tuc khi app mo; moi thao tac lay them mot toa do moi ngay luc bam.
//   SIMULATED  vi tri gia lap: chon "dang o" mot diem check-in hoac nhap toa do - dung khi kiem thu (Playwright,
//              may ao) hoac khi may khong co GPS / tai xe khong cho phep dinh vi.
// Moi vi tri mang nguon (source: GPS | SIMULATED) va sai so GPS (accuracyM) - API luu kem toa do.
const SIM_KEY = "edms.simulatedPosition";
const MODE_KEY = "edms.positionMode";
// Mac dinh gia lap: Hub Ha Noi (quan Hoan Kiem)
export const DEFAULT_POSITION = { lat: 21.0285, lng: 105.8542, label: "Hub Hà Nội (mặc định)", source: "SIMULATED" };
const ACTION_FIX_TIMEOUT_MS = 10_000;

let simulated = DEFAULT_POSITION;
let gps = null; // toa do GPS moi nhat
let mode = "GPS";
let gpsState = { state: "idle", message: "" }; // idle | waiting | ok | denied | unavailable
let subscription = null;
let loaded = false;
const listeners = new Set();
const stateListeners = new Set();

const notify = () => listeners.forEach((listener) => listener(getPosition()));
const notifyState = () => stateListeners.forEach((listener) => listener(getGpsState()));

function setGpsState(state, message = "") {
  gpsState = { state, message };
  notifyState();
}

export async function loadPosition() {
  if (loaded) return getPosition();
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(SIM_KEY);
    if (raw) simulated = { ...DEFAULT_POSITION, ...JSON.parse(raw), source: "SIMULATED" };
    const savedMode = await AsyncStorage.getItem(MODE_KEY);
    if (savedMode === "GPS" || savedMode === "SIMULATED") mode = savedMode;
  } catch {
    // khong doc duoc bo nho -> dung mac dinh
  }
  if (mode === "GPS") startGps();
  return getPosition();
}

/** Vi tri dang dung: GPS khi che do GPS va da co toa do; con lai la vi tri gia lap. */
export function getPosition() {
  return mode === "GPS" && gps ? gps : simulated;
}

export const getMode = () => mode;
export const getGpsState = () => ({ ...gpsState, mode, usingGps: mode === "GPS" && Boolean(gps) });

export async function setMode(next) {
  mode = next === "SIMULATED" ? "SIMULATED" : "GPS";
  try {
    await AsyncStorage.setItem(MODE_KEY, mode);
  } catch {
    // bo qua: van dung trong phien
  }
  if (mode === "GPS") await startGps();
  else stopGps();
  notifyState();
  notify();
}

const fromCoords = (coords) => ({
  lat: coords.latitude,
  lng: coords.longitude,
  accuracyM: coords.accuracy == null ? null : Math.round(coords.accuracy),
  source: "GPS",
  label: coords.accuracy == null ? "GPS" : `GPS ±${Math.round(coords.accuracy)} m`,
});

/** Xin quyen va bat theo doi vi tri. Khong co quyen / khong co GPS -> dung vi tri gia lap, bao ly do. */
export async function startGps() {
  if (subscription) return true;
  setGpsState("waiting", "Đang xin quyền định vị...");
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      setGpsState("unavailable", "Máy chưa bật định vị (GPS) — đang dùng vị trí giả lập");
      return false;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setGpsState("denied", "Chưa cho phép ứng dụng dùng vị trí — đang dùng vị trí giả lập");
      return false;
    }
    setGpsState("waiting", "Đang chờ tín hiệu GPS...");
    subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 15 },
      (location) => {
        gps = fromCoords(location.coords);
        if (gpsState.state !== "ok") setGpsState("ok");
        notify();
      },
    );
    return true;
  } catch {
    setGpsState("unavailable", "Không lấy được vị trí trên thiết bị này — đang dùng vị trí giả lập");
    return false;
  }
}

export function stopGps() {
  subscription?.remove?.();
  subscription = null;
  gps = null;
  setGpsState("idle");
}

/**
 * Vi tri ghi kem mot thao tac (lay hang, giao hang, tra hang): che do GPS thi lay toa do moi ngay luc bam
 * (toi da 10 giay), khong duoc thi dung toa do GPS gan nhat, cuoi cung la vi tri gia lap.
 */
export async function positionForAction() {
  if (mode !== "GPS" || gpsState.state === "denied" || gpsState.state === "unavailable") return getPosition();
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ACTION_FIX_TIMEOUT_MS)),
    ]);
    gps = fromCoords(fresh.coords);
    notify();
  } catch {
    // giu toa do gan nhat
  }
  return getPosition();
}

/** Truong gui API kem toa do. */
export const toPayload = (p) => ({ lat: p.lat, lng: p.lng, positionSource: p.source || "SIMULATED", ...(p.accuracyM != null && { accuracyM: p.accuracyM }) });

/** Dat vi tri gia lap (chon diem / nhap toa do) - tu chuyen sang che do gia lap. */
export async function setPosition({ lat, lng, label }) {
  simulated = {
    lat: Number(lat),
    lng: Number(lng),
    label: label || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
    source: "SIMULATED",
  };
  loaded = true;
  try {
    await AsyncStorage.setItem(SIM_KEY, JSON.stringify(simulated));
  } catch {
    // bo qua: van dung trong phien
  }
  if (mode !== "SIMULATED") await setMode("SIMULATED");
  else notify();
  return simulated;
}

export function onPositionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onGpsStateChange(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export const formatPosition = (p) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

/** Khoang cach (m) giua hai toa do - de app chi tu check-in khi da vao ban kinh diem (do server tu choi). */
export function distanceM(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
