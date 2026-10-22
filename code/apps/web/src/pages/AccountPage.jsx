import { useEffect, useState } from "react";
import { apiClient, errorMessage } from "../lib/apiClient.js";

const CUSTOMER_TYPE_LABELS = { INDIVIDUAL: "Cá nhân", BUSINESS: "Doanh nghiệp / shop" };

export default function AccountPage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient
      .get("/auth/me")
      .then((res) => setProfile(res.data.data))
      .catch((err) => setError(errorMessage(err, "Không tải được thông tin tài khoản")));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tài khoản của tôi</h1>

      {error && <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!profile && !error && <p className="mt-6 text-gray-500">Đang tải...</p>}

      {profile && (
        <dl className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          <Row label="Họ tên" value={profile.fullName} />
          <Row label="Email" value={profile.email} />
          <Row label="Số điện thoại" value={profile.phone} />
          <Row label="Loại khách hàng" value={CUSTOMER_TYPE_LABELS[profile.customerType] || "—"} />
          {profile.shopName && <Row label="Tên shop" value={profile.shopName} />}
        </dl>
      )}

      <section className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <h2 className="font-semibold">Đơn hàng của tôi</h2>
        <p className="mt-1 text-sm text-gray-500">Danh sách và chi tiết đơn hàng — sắp có (#20 · Sprint 4).</p>
      </section>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-4 px-5 py-3">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm font-medium">{value}</dd>
    </div>
  );
}
