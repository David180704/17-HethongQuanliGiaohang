import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { STAFF_APP_URL } from "../lib/links.js";

const NAV = [
  { to: "/", label: "Trang chủ", end: true },
  { to: "/bang-gia", label: "Bảng giá" },
  { to: "/vung-phuc-vu", label: "Vùng phục vụ" },
];

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
    isActive ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
  }`;

export default function SiteLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand-600">E</span>
            <span className="hidden sm:inline">EDMS Express</span>
          </Link>

          <nav className="ml-2 hidden gap-1 md:flex" aria-label="Điều hướng chính">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/tao-don"
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-600 shadow-sm hover:bg-brand-50 sm:px-4"
            >
              Tạo đơn
            </Link>
            {user ? (
              <>
                <Link
                  to="/tai-khoan"
                  className="hidden max-w-40 truncate rounded-md px-2 py-1.5 text-sm font-medium hover:bg-white/10 sm:block"
                  title={user.fullName}
                >
                  {user.fullName}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/dang-nhap" className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-white/10">
                  Đăng nhập
                </Link>
                <Link
                  to="/dang-ky"
                  className="hidden rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10 sm:block"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Điều hướng chính (di động)">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-gray-700">EDMS Express</span> — Hệ thống quản lý giao hàng (đồ án
            CNPM nâng cao)
          </p>
          <p>
            Bạn là nhân viên?{" "}
            <a href={STAFF_APP_URL} className="font-medium text-brand-600 hover:underline">
              Mở App Nhân viên
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
