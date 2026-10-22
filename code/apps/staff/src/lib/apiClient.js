import axios from "axios";
import { API_URL } from "../config";
import { getTokens, setTokens, clearTokens } from "./tokenStore";

export const apiClient = axios.create({ baseURL: API_URL, timeout: 15000 });

// Server co guard nguoc o login/register: gui kem token cu se bi tu choi
// ALREADY_AUTHENTICATED, nen khong gan token vao cac duong dan nay.
const NO_TOKEN_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];
const isNoTokenPath = (url = "") => NO_TOKEN_PATHS.some((path) => url.startsWith(path));

let unauthorizedHandler = () => {};
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken && !isNoTokenPath(config.url)) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise = null;

// 401 -> lam moi token 1 lan roi goi lai request cu. Nhieu request cung bi 401
// cung luc thi dung chung 1 lan refresh (refresh token xoay vong, goi 2 lan se
// lam lan sau dung token da bi vo hieu).
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (!config || response?.status !== 401 || isNoTokenPath(config.url) || config._retried) {
      return Promise.reject(error);
    }

    const { refreshToken } = getTokens();
    if (!refreshToken) {
      await clearTokens();
      unauthorizedHandler();
      return Promise.reject(error);
    }

    config._retried = true;

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${API_URL}/auth/refresh`, { refreshToken })
        .then(async (res) => {
          await setTokens(res.data.data);
          return res.data.data;
        })
        .catch(async (refreshErr) => {
          await clearTokens();
          unauthorizedHandler();
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

export function errorMessage(err, fallback = "Có lỗi xảy ra, vui lòng thử lại") {
  const serverMessage = err?.response?.data?.error?.message;
  if (serverMessage) return serverMessage;
  if (!err?.response) return `Không kết nối được máy chủ (${API_URL}). Kiểm tra API đã chạy chưa.`;
  return fallback;
}
