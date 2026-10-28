import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, onUnauthorized } from "../lib/apiClient";
import { clearTokens, getTokens, loadTokens, setTokens } from "../lib/tokenStore";
import { queryCache } from "../lib/queryCache";
import { CUSTOMER_ROLE } from "../config";

const AuthContext = createContext(null);

// Khach vang lai dung app binh thuong (user = null). Chi tao don / thanh toan moi can
// dang nhap - cung quy tac voi Web Khach hang.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const fetchProfile = useCallback(async () => {
    const res = await apiClient.get("/auth/me");
    return res.data.data;
  }, []);

  useEffect(() => {
    onUnauthorized(() => setUser(null));

    (async () => {
      const { accessToken, refreshToken } = await loadTokens();
      if (accessToken || refreshToken) {
        try {
          const profile = await fetchProfile();
          if (profile.role === CUSTOMER_ROLE) setUser(profile);
          else await clearTokens();
        } catch (err) {
          // Chi xoa phien khi server noi token khong con hop le; mat mang thi giu lai.
          if (err?.response?.status === 401 || err?.response?.status === 403) await clearTokens();
        }
      }
      setBooting(false);
    })();
  }, [fetchProfile]);

  const login = useCallback(
    async (emailOrPhone, password) => {
      // app: "CUSTOMER" -> server tu choi tai khoan nhan vien (WRONG_APP), khong cap token.
      const res = await apiClient.post("/auth/login", { emailOrPhone: emailOrPhone.trim(), password, app: "CUSTOMER" });
      queryCache.clear();
      await setTokens(res.data.data);
      const profile = await fetchProfile();
      setUser(profile);
      return profile;
    },
    [fetchProfile],
  );

  // Ca nhan: ACTIVE ngay -> dang nhap luon. Doanh nghiep: PENDING -> cho quan tri vien duyet.
  const register = useCallback(
    async (payload) => {
      const res = await apiClient.post("/auth/register", payload);
      const created = res.data.data;
      if (created.status === "ACTIVE") await login(payload.email, payload.password);
      return created;
    },
    [login],
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getTokens();
    try {
      if (refreshToken) await apiClient.post("/auth/logout", { refreshToken });
    } catch {
      // Token het han/khong hop le cung khong sao, van dang xuat phia app.
    }
    queryCache.clear();
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, booting, login, register, logout }), [user, booting, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phai dung ben trong AuthProvider");
  return ctx;
}
