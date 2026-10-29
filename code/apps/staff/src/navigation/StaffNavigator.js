import { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { confirmAsync } from "../lib/dialog";
import { ROLE_THEME } from "../theme";
import ResourceScreen from "../components/ResourceScreen";
import AdminHome from "../screens/admin/AdminHome";
import { CATALOGS } from "../screens/admin/catalogs";
import HubHome from "../screens/hub/HubHome";
import ShipperHome from "../screens/shipper/ShipperHome";

// Dieu huong dang ngan xep tu viet (khong them thu vien): moi vai tro chi co vai
// man hinh. Man hinh goc re nhanh theo user.role - day la cho "giao dien doi
// theo vai tro sau khi dang nhap".
export default function StaffNavigator({ user }) {
  const { logout } = useAuth();
  const [stack, setStack] = useState([]);
  const theme = ROLE_THEME[user.role];

  const push = useCallback((route) => setStack((current) => [...current, route]), []);
  const pop = useCallback(() => setStack((current) => current.slice(0, -1)), []);

  // Nut Back cua Android: lui man hinh truoc khi thoat app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length === 0) return false;
      pop();
      return true;
    });
    return () => subscription.remove();
  }, [stack.length, pop]);

  const requestLogout = useCallback(async () => {
    const confirmed = await confirmAsync("Đăng xuất?", "Bạn sẽ cần đăng nhập lại để tiếp tục.", "Đăng xuất");
    if (confirmed) logout();
  }, [logout]);

  const top = stack[stack.length - 1];
  if (top?.name === "catalog") {
    return <ResourceScreen config={CATALOGS[top.key]} accent={theme.color} onBack={pop} />;
  }

  const homeProps = { user, theme, onLogout: requestLogout };
  if (user.role === "ADMIN") {
    return <AdminHome {...homeProps} onOpenCatalog={(key) => push({ name: "catalog", key })} />;
  }
  if (user.role === "HUB_STAFF") return <HubHome {...homeProps} />;
  return <ShipperHome {...homeProps} />;
}
