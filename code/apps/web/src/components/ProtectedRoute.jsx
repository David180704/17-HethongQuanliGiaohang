import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Trang chi danh cho khach da dang nhap (tao don, tai khoan). Chua dang nhap ->
// sang trang dang nhap kem ?next= de quay lai dung cho dang lam.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/dang-nhap?next=${next}`} replace />;
  }
  return children;
}
