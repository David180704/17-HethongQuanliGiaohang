import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import SiteLayout from "./components/SiteLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import GuestOnlyRoute from "./components/GuestOnlyRoute.jsx";
import HomePage from "./pages/HomePage.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import CoveragePage from "./pages/CoveragePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import CreateOrderPage from "./pages/CreateOrderPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

// Web Khach hang: khach vang lai xem duoc trang chu, bang gia, vung phuc vu.
// Chi "Tao don" va "Tai khoan" moi doi dang nhap (ProtectedRoute).
// Trang quan tri da chuyen sang App Nhan vien (apps/staff).
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="bang-gia" element={<PricingPage />} />
            <Route path="vung-phuc-vu" element={<CoveragePage />} />
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
