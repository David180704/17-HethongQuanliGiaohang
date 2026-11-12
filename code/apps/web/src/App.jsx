import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import SiteLayout from "./components/SiteLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import GuestOnlyRoute from "./components/GuestOnlyRoute.jsx";
import HomePage from "./pages/HomePage.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import EstimatePage from "./pages/EstimatePage.jsx";
import CoveragePage from "./pages/CoveragePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import CreateOrderPage from "./pages/CreateOrderPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import PickupLocationsPage from "./pages/PickupLocationsPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import SettlementsPage from "./pages/SettlementsPage.jsx";
import TrackingPage from "./pages/TrackingPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

// Web Khach hang: khach vang lai xem duoc trang chu, bang gia, vung phuc vu.
// Chi "Tao don" va "Tai khoan" moi doi dang nhap (ProtectedRoute).
// Trang quan tri da chuyen sang App Nhan vien (apps/staff).
//
// useTransitions={false}: mac dinh react-router boc moi lan doi URL trong
// startTransition (uu tien thap hon setState thuong). Khi dang xuat o trang can
// dang nhap, React ve user=null TRUOC khi URL kip doi -> ProtectedRoute day sang
// /dang-nhap?next=..., de mat lenh navigate("/"). Tat transition thi hai cap nhat
// duoc gop vao cung mot lan ve. App khong dung Suspense nen khong mat gi.
export default function App() {
  return (
    <BrowserRouter useTransitions={false}>
      <AuthProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="bang-gia" element={<PricingPage />} />
            <Route path="uoc-tinh-phi" element={<EstimatePage />} />
            <Route path="vung-phuc-vu" element={<CoveragePage />} />
            <Route path="tra-cuu" element={<TrackingPage />} />
            <Route
              path="tao-don"
              element={
                <ProtectedRoute>
                  <CreateOrderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="tai-khoan"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="dia-diem-lay-hang"
              element={
                <ProtectedRoute>
                  <PickupLocationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="don-hang"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="don-hang/:id"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="doi-soat"
              element={
                <ProtectedRoute>
                  <SettlementsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route
            path="dang-nhap"
            element={
              <GuestOnlyRoute>
                <LoginPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="dang-ky"
            element={
              <GuestOnlyRoute>
                <RegisterPage />
              </GuestOnlyRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
