import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { safeNext } from "../lib/safeNext.js";

// Guard nguoc phia giao dien (server cung chan ALREADY_AUTHENTICATED): da dang
// nhap ma vao trang dang nhap/dang ky thi chuyen di. Dung cung dich ?next= voi
// trang dang nhap de ngay sau khi dang nhap xong hai ben khong dieu huong khac nhau.
export default function GuestOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  if (isAuthenticated) return <Navigate to={safeNext(params.get("next"))} replace />;
  return children;
}
