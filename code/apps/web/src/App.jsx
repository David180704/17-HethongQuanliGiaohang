import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import RoutesPage from "./pages/RoutesPage.jsx";
import ServiceAreasPage from "./pages/ServiceAreasPage.jsx";
import ServiceTypesPage from "./pages/ServiceTypesPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/users"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <RoutesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-areas"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ServiceAreasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/service-types"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <ServiceTypesPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
