import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Menu theo vai tro - chi ADMIN co menu quan tri danh muc o Sprint 1-2.
// Cac vai tro khac se co menu rieng khi nghiep vu tuong ung duoc xay (Sprint 3+).
const MENU_BY_ROLE = {
  ADMIN: [
    { to: "/", label: "Tổng quan", end: true },
    { to: "/users", label: "Người dùng" },
    { to: "/routes", label: "Tuyến" },
    { to: "/service-areas", label: "Khu vực phục vụ" },
    { to: "/service-types", label: "Loại dịch vụ" },
  ],
  CUSTOMER: [{ to: "/", label: "Tổng quan", end: true }],
  SHIPPER: [{ to: "/", label: "Tổng quan", end: true }],
  HUB_STAFF: [{ to: "/", label: "Tổng quan", end: true }],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const menu = MENU_BY_ROLE[user?.role] || [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <p className="text-lg font-bold text-blue-700">EDMS</p>
          <p className="text-xs text-gray-500">Quản lý giao hàng</p>
        </div>
        <nav className="space-y-1 p-3">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="text-sm text-gray-500">
            Xin chào, <span className="font-medium text-gray-800">{user?.fullName}</span>{" "}
            <span className="ml-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{user?.role}</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600">
            Đăng xuất
          </button>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
