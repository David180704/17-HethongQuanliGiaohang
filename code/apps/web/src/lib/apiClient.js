import axios from "axios";
import { getTokens, setTokens, clearTokens } from "./tokenStore.js";

// Mac dinh: cung hostname voi trang dang mo, cong 4044. Mo web tren dien thoai
// bang IP LAN (vd 192.168.1.10:5173) thi API cung tu theo IP do - "localhost"
// tren dien thoai la chinh dien thoai, khong phai may dev.
const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4044`;

export const apiClient = axios.create({ baseURL: API_URL, timeout: 15000 });

// Server co guard nguoc o login/register: gui kem token cu se bi tu choi
// ALREADY_AUTHENTICATED, nen khong gan token vao cac duong dan nay.
const NO_TOKEN_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];
const isNoTokenPath = (url = "") => NO_TOKEN_PATHS.some((path) => url.startsWith(path));

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken && !isNoTokenPath(config.url)) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export function errorMessage(err, fallback = "Có lỗi xảy ra, vui lòng thử lại") {
  const serverMessage = err?.response?.data?.error?.message;
  if (serverMessage) return serverMessage;
  if (!err?.response) return "Không kết nối được máy chủ. Vui lòng thử lại sau.";
  return fallback;
}

let refreshPromise = null;

// 401 -> thu lam moi token 1 lan roi goi lai request cu. Nhieu request cung
// bi 401 cung luc thi dung chung 1 lan refresh (khong goi /auth/refresh nhieu lan).
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const isAuthEndpoint = config?.url?.startsWith("/auth/login") || config?.url?.startsWith("/auth/refresh");

    if (response?.status !== 401 || isAuthEndpoint || config._retried) {
      return Promise.reject(error);
    }

    const { refreshToken } = getTokens();
    if (!refreshToken) {
      clearTokens();
      window.dispatchEvent(new Event("edms:unauthorized"));
      return Promise.reject(error);
    }

    config._retried = true;

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${API_URL}/auth/refresh`, { refreshToken })
        .then((res) => {
          setTokens(res.data.data);
          return res.data.data;
        })
        .catch((refreshErr) => {
          clearTokens();
          window.dispatchEvent(new Event("edms:unauthorized"));
          throw refreshErr;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newTokens = await refreshPromise;
    config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
    return apiClient(config);
  },
);
