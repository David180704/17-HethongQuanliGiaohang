import axios from "axios";
import { getTokens, setTokens, clearTokens } from "./tokenStore.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

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
