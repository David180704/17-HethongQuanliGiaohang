import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient } from "../lib/apiClient.js";
import { getTokens, setTokens, clearTokens, getStoredUser, setStoredUser } from "../lib/tokenStore.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("edms:unauthorized", onUnauthorized);
    return () => window.removeEventListener("edms:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (emailOrPhone, password) => {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", { emailOrPhone, password });
      const { accessToken, refreshToken, user: loggedInUser } = res.data.data;
      setTokens({ accessToken, refreshToken });
      setStoredUser(loggedInUser);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: Boolean(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phai dung ben trong AuthProvider");
  return ctx;
}
