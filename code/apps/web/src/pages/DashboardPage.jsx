import { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";

function StatCard({ label, value, loading }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? "…" : value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }
    Promise.all(
      ["/users", "/routes", "/serviceAreas", "/serviceTypes"].map((endpoint) =>
        apiClient.get(endpoint, { params: { limit: 1 } }).then((res) => [endpoint, res.data.meta.total]),
      ),
    )
      .then((results) => setCounts(Object.fromEntries(results)))
      .finally(() => setLoading(false));
  }, [user]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Chào {user?.fullName}</h1>
        <p className="text-sm text-gray-500">
          Nghiệp vụ dành cho vai trò {user?.role} (tạo đơn, giao hàng...) sẽ có từ Sprint 3 trở đi.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Tổng quan</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Người dùng" value={counts["/users"]} loading={loading} />
        <StatCard label="Tuyến" value={counts["/routes"]} loading={loading} />
        <StatCard label="Khu vực phục vụ" value={counts["/serviceAreas"]} loading={loading} />
        <StatCard label="Loại dịch vụ" value={counts["/serviceTypes"]} loading={loading} />
      </div>
    </div>
  );
}
