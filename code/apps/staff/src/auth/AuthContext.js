import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, onUnauthorized } from "../lib/apiClient";
import { clearTokens, getTokens, loadTokens, setTokens } from "../lib/tokenStore";
import { queryCache } from "../lib/queryCache";
import { STAFF_ROLES } from "../config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");

  // /auth/me tra ve ho so day du, kem ten hub/tuyen (login chi tra ban rut gon).
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
          if (STAFF_ROLES.includes(profile.role)) {
            setUser(profile);
          } else {
            await clearTokens();
          }
        } catch (err) {
          // Chi xoa phien khi server noi token khong con hop le. Mat mang luc mo
          // app thi giu token, nguoi dung dang nhap lai khi co mang.
          if (err?.response?.status === 401 || err?.response?.status === 403) await clearTokens();
          else setBootError("Không kết nối được máy chủ, vui lòng đăng nhập lại khi có mạng.");
        }
      }
      setBooting(false);
    })();
  }, [fetchProfile]);

  const login = useCallback(
    async (emailOrPhone, password) => {
      // app: "STAFF" -> server tu choi tai khoan CUSTOMER (WRONG_APP), khong cap token.
      const res = await apiClient.post("/auth/login", { emailOrPhone: emailOrPhone.trim(), password, app: "STAFF" });
      // Nguoi dung khac co the khac quyen -> bo cache cua phien truoc
      queryCache.clear();
      await setTokens(res.data.data);
      const profile = await fetchProfile();
      setBootError("");
      setUser(profile);
      return profile;
    },
    [fetchProfile],
  );

  const logout = useCallback(async () => {
    const { refreshToken } = getTokens();
    try {
      if (refreshToken) await apiClient.post("/auth/logout", { refreshToken });
    } catch {
      // Token het han/khong hop le cung khong sao, van dang xuat phia client.
    }
    // May dung chung nhieu ca: nguoi sau khong duoc thay du lieu cache cua nguoi truoc
    queryCache.clear();
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, bootError, login, logout }),
    [user, booting, bootError, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phai dung ben trong AuthProvider");
  return ctx;
}
