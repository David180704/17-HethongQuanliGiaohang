import { useCallback, useEffect, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { confirmAsync } from "../lib/dialog";
import TabBar from "../components/TabBar";
import HomeScreen from "../screens/HomeScreen";
import PricingScreen from "../screens/PricingScreen";
import CoverageScreen from "../screens/CoverageScreen";
import AccountScreen from "../screens/AccountScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import CreateOrderScreen from "../screens/CreateOrderScreen";
import { colors } from "../theme";

// Dieu huong tu viet (khong them thu vien, giong App Nhan vien):
//   - 4 tab: Trang chu, Bang gia, Vung phuc vu, Tai khoan - khach vang lai xem duoc het
//   - ngan xep man hinh con: dang nhap, dang ky, tao don
// Quy tac giong Web Khach hang: bam "Tao don" khi chua dang nhap -> dang nhap ->
// quay lai DUNG man hinh tao don.
export default function AppNavigator() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);

  const push = useCallback((route) => setStack((current) => [...current, route]), []);
  const pop = useCallback(() => setStack((current) => current.slice(0, -1)), []);

  const openCreateOrder = useCallback(() => {
    if (user) push({ name: "createOrder" });
    else push({ name: "login", next: "createOrder" });
  }, [user, push]);

  // Dang nhap/dang ky xong: mo man hinh dang cho (tao don), neu khong thi ve tab Tai khoan.
  const handleLoggedIn = useCallback((next) => {
    if (next === "createOrder") {
      setStack([{ name: "createOrder" }]);
    } else {
      setStack([]);
      setTab("account");
    }
  }, []);

  const goTab = useCallback((key) => {
    setStack([]);
    setTab(key);
  }, []);

  const requestLogout = useCallback(async () => {
    const confirmed = await confirmAsync("Đăng xuất?", "Bạn vẫn xem được bảng giá và vùng phục vụ.", "Đăng xuất");
    if (!confirmed) return;
    await logout();
    setStack([]);
    setTab("home");
  }, [logout]);

  // Nut Back cua Android: lui man hinh con -> ve Trang chu -> moi thoat app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stack.length > 0) {
        pop();
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, tab, pop]);

  const top = stack[stack.length - 1];
  if (top?.name === "login" && !user) {
    return (
      <LoginScreen
        next={top.next}
        onBack={pop}
        onLoggedIn={handleLoggedIn}
        onRegister={(next) => setStack((current) => [...current.slice(0, -1), { name: "register", next }])}
      />
    );
  }
  if (top?.name === "register" && !user) {
    return (
      <RegisterScreen
        next={top.next}
        onBack={pop}
        onLoggedIn={handleLoggedIn}
        onLogin={(next) => setStack((current) => [...current.slice(0, -1), { name: "login", next }])}
        onHome={() => goTab("home")}
      />
    );
  }
  if (top?.name === "createOrder" && user) {
    return <CreateOrderScreen onBack={pop} onGoTab={goTab} />;
  }

  const tabProps = {
    onGoTab: goTab,
    onCreateOrder: openCreateOrder,
    onLogin: () => push({ name: "login" }),
    onRegister: () => push({ name: "register" }),
    onLogout: requestLogout,
  };

  return (
    <View style={styles.root}>
      <View style={styles.page}>
        {tab === "home" ? <HomeScreen {...tabProps} /> : null}
        {tab === "pricing" ? <PricingScreen {...tabProps} /> : null}
        {tab === "coverage" ? <CoverageScreen {...tabProps} /> : null}
        {tab === "account" ? <AccountScreen {...tabProps} /> : null}
      </View>
      <TabBar active={tab} onChange={goTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1 },
});
