import { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { confirmAsync } from "../lib/dialog";
import { ROLE_THEME } from "../theme";
import ResourceScreen from "../components/ResourceScreen";
import AdminHome from "../screens/admin/AdminHome";
import { CATALOGS } from "../screens/admin/catalogs";
import HubHome from "../screens/hub/HubHome";
import ApproveOrdersScreen from "../screens/hub/ApproveOrdersScreen";
import CounterIntakeScreen from "../screens/hub/CounterIntakeScreen";
import ShiftsScreen from "../screens/hub/ShiftsScreen";
import CapacityScreen from "../screens/hub/CapacityScreen";
import AssignPickupScreen from "../screens/hub/AssignPickupScreen";
import WarehouseScreen from "../screens/hub/WarehouseScreen";
import PickupListScreen from "../screens/shipper/PickupListScreen";
import CheckinScreen from "../screens/shipper/CheckinScreen";
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
  if (top?.name === "shifts") {
    return <ShiftsScreen accent={theme.color} onBack={pop} />;
  }
  if (top?.name === "warehouse") {
    return <WarehouseScreen accent={theme.color} onBack={pop} />;
  }
  if (top?.name === "assignPickup") {
    return <AssignPickupScreen accent={theme.color} onBack={pop} onOpenCapacity={() => push({ name: "capacity" })} />;
  }
  if (top?.name === "checkin") {
    return <CheckinScreen accent={theme.color} onBack={pop} />;
  }
  if (top?.name === "pickups") {
    return <PickupListScreen accent={theme.color} onBack={pop} />;
  }
  if (top?.name === "capacity") {
    return <CapacityScreen user={user} accent={theme.color} onBack={pop} />;
  }
  if (top?.name === "counterIntake") {
    return <CounterIntakeScreen user={user} accent={theme.color} onBack={pop} />;
  }
  if (top?.name === "approveOrders") {
    return <ApproveOrdersScreen user={user} accent={theme.color} onBack={pop} />;
  }

  const homeProps = { user, theme, onLogout: requestLogout };
  if (user.role === "ADMIN") {
    return (
      <AdminHome
        {...homeProps}
        onOpenCatalog={(key) => push({ name: "catalog", key })}
        onOpenCapacity={() => push({ name: "capacity" })}
      />
    );
  }
  if (user.role === "HUB_STAFF") {
    return <HubHome
        {...homeProps}
        onOpenApprove={() => push({ name: "approveOrders" })}
        onOpenCounter={() => push({ name: "counterIntake" })}
        onOpenShifts={() => push({ name: "shifts" })}
        onOpenAssign={() => push({ name: "assignPickup" })}
        onOpenWarehouse={() => push({ name: "warehouse" })}
      />;
  }
  return (
    <ShipperHome {...homeProps} onOpenPickups={() => push({ name: "pickups" })} onOpenCheckin={() => push({ name: "checkin" })} />
  );
}
