import AsyncStorage from "@react-native-async-storage/async-storage";

// Token giu trong bo nho de interceptor doc dong bo; AsyncStorage chi dung de
// khoi phuc phien khi mo lai app. Tren web, AsyncStorage = localStorage theo
// origin, nen App Nhan vien (cong 8082) khong dung chung phien voi Web Khach
// hang (cong 5173) - hai nguoi dang nhap song song tren cung mot may duoc.
const KEY = "edms_staff_session";
const EMPTY = { accessToken: null, refreshToken: null };

let memory = { ...EMPTY };

export async function loadTokens() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    memory = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    memory = { ...EMPTY };
  }
  return memory;
}

export function getTokens() {
  return memory;
}

export async function setTokens({ accessToken, refreshToken }) {
  memory = {
    accessToken: accessToken ?? memory.accessToken,
    refreshToken: refreshToken ?? memory.refreshToken,
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Khong luu duoc thi van dung token trong bo nho, chi mat phien khi tat app.
  }
}

export async function clearTokens() {
  memory = { ...EMPTY };
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Bo qua - bo nho da xoa.
  }
}
