import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/apiClient.js";
import { safeNext } from "../lib/safeNext.js";
import { inputClass, primaryButtonClass } from "../lib/ui.js";
import AuthShell, { Field } from "../components/AuthShell.jsx";

const CUSTOMER_TYPES = [
  { value: "INDIVIDUAL", label: "Cá nhân", hint: "Dùng được ngay sau khi đăng ký." },
  { value: "BUSINESS", label: "Doanh nghiệp / shop", hint: "Cần quản trị viên duyệt trước khi đăng nhập." },
];

const EMPTY_FORM = { fullName: "", email: "", phone: "", password: "", shopName: "", taxCode: "" };

export default function RegisterPage() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [customerType, setCustomerType] = useState("INDIVIDUAL");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingBusiness, setPendingBusiness] = useState(null);

  const isBusiness = customerType === "BUSINESS";
  const inputProps = (name) => ({
    id: `reg-${name}`,
    required: true,
    value: form[name],
    onChange: (e) => setForm((prev) => ({ ...prev, [name]: e.target.value })),
    className: inputClass,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      customerType,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      ...(isBusiness ? { shopName: form.shopName.trim(), taxCode: form.taxCode.trim() } : {}),
    };
    try {
      const created = await register(payload);
      // Ca nhan: register() da dang nhap -> GuestOnlyRoute tu chuyen ve ?next.
      if (created.status !== "ACTIVE") setPendingBusiness(created);
    } catch (err) {
      setError(errorMessage(err, "Đăng ký thất bại"));
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingBusiness) {
    return (
      <AuthShell title="Đăng ký">
        <div role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Đã gửi yêu cầu mở tài khoản doanh nghiệp cho <b>{pendingBusiness.email}</b>. Quản trị viên sẽ duyệt và báo
          qua email; sau đó bạn đăng nhập để tạo đơn.
        </div>
        <Link to="/" className="mt-6 block text-center text-sm font-semibold text-brand-600 hover:underline">
          Về trang chủ
        </Link>
      </AuthShell>
    );
  }

  const loginLink = next === "/" ? "/dang-nhap" : `/dang-nhap?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title="Đăng ký"
      subtitle="Tạo tài khoản khách hàng để gửi hàng và theo dõi đơn."
      footer={
        <p>
          Đã có tài khoản?{" "}
          <Link to={loginLink} className="font-semibold text-brand-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Loại khách hàng">
          {CUSTOMER_TYPES.map((type) => {
            const active = type.value === customerType;
            return (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCustomerType(type.value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active ? "bg-white text-brand-600 shadow-sm" : "text-gray-600"
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">{CUSTOMER_TYPES.find((t) => t.value === customerType).hint}</p>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Field id="reg-fullName" label="Họ tên">
          <input {...inputProps("fullName")} autoComplete="name" />
        </Field>
        <Field id="reg-email" label="Email">
          <input {...inputProps("email")} type="email" autoComplete="email" />
        </Field>
        <Field id="reg-phone" label="Số điện thoại">
          <input {...inputProps("phone")} type="tel" autoComplete="tel" />
        </Field>
        <Field id="reg-password" label="Mật khẩu">
          <input {...inputProps("password")} type="password" autoComplete="new-password" />
        </Field>
        {isBusiness && (
          <>
            <Field id="reg-shopName" label="Tên shop / doanh nghiệp">
              <input {...inputProps("shopName")} />
            </Field>
            <Field id="reg-taxCode" label="Mã số thuế">
              <input {...inputProps("taxCode")} />
            </Field>
          </>
        )}

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>
    </AuthShell>
  );
}
