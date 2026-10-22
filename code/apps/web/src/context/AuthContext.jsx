import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../lib/apiClient.js";
import { getTokens, setTokens, clearTokens, getStoredUser, setStoredUser } from "../lib/tokenStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("edms:unauthorized", onUnauthorized);
    return () => window.removeEventListener("edms:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (emailOrPhone, password) => {
    // app: "CUSTOMER" -> server tu choi tai khoan nhan vien (WRONG_APP), khong cap token.
    const res = await apiClient.post("/auth/login", { emailOrPhone: emailOrPhone.trim(), password, app: "CUSTOMER" });
    const { accessToken, refreshToken, user: loggedInUser } = res.data.data;
    setTokens({ accessToken, refreshToken });
    setStoredUser(loggedInUser);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  // Ca nhan: ACTIVE ngay -> dang nhap luon. Doanh nghiep: PENDING -> cho admin duyet,
  // chua dang nhap duoc.
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
      // Da het han/khong hop le cung khong sao, van dang xuat phia client.
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), login, register, logout }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phai dung ben trong AuthProvider");
  return ctx;
}
