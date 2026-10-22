import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/apiClient.js";
import { safeNext } from "../lib/safeNext.js";
import { inputClass, primaryButtonClass } from "../lib/ui.js";
import AuthShell, { Field } from "../components/AuthShell.jsx";
import { STAFF_APP_URL } from "../lib/links.js";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(emailOrPhone, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Đăng nhập thất bại"));
      setSubmitting(false);
    }
  }

  const registerLink = next === "/" ? "/dang-ky" : `/dang-ky?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle={next === "/tao-don" ? "Đăng nhập để tạo đơn và thanh toán." : "Chào mừng bạn quay lại."}
      footer={
        <>
          <p>
            Chưa có tài khoản?{" "}
            <Link to={registerLink} className="font-semibold text-brand-600 hover:underline">
              Đăng ký
            </Link>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Nhân viên công ty dùng{" "}
            <a href={STAFF_APP_URL} className="font-medium text-gray-700 hover:underline">
              App Nhân viên
            </a>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <Field id="login-identity" label="Email hoặc số điện thoại">
          <input
            id="login-identity"
            type="text"
            required
            autoFocus
            autoComplete="username"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="login-password" label="Mật khẩu">
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-brand-600"
            >
              {showPassword ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </Field>
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </AuthShell>
  );
}
