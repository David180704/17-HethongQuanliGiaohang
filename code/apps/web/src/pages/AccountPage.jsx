import { Link } from "react-router-dom";
import { errorMessage } from "../lib/apiClient.js";
import { useCachedQuery } from "../lib/useCachedQuery.js";

const CUSTOMER_TYPE_LABELS = { INDIVIDUAL: "Cá nhân", BUSINESS: "Doanh nghiệp / shop" };

export default function AccountPage() {
  const { data: profile, error: loadError } = useCachedQuery("/auth/me");
  const { data: locations, meta: locationMeta } = useCachedQuery("/pickupLocations");
  const defaultLocation = locations?.find((location) => location.isDefault);
  const error = loadError ? errorMessage(loadError, "Không tải được thông tin tài khoản") : "";

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

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">Địa điểm lấy hàng</h2>
          <p className="mt-1 text-sm text-gray-500">
            {locations
              ? `${locations.length}/${locationMeta?.max ?? 10} địa điểm${defaultLocation ? ` · mặc định: ${defaultLocation.label}` : ""}`
              : "Đang tải..."}
          </p>
        </div>
        <Link
          to="/dia-diem-lay-hang"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Quản lý địa điểm
        </Link>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">Đơn hàng của tôi</h2>
          <p className="mt-1 text-sm text-gray-500">Lọc theo trạng thái, thời gian; xem hành trình từng đơn.</p>
        </div>
        <Link to="/don-hang" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50">
          Xem đơn hàng
        </Link>
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
