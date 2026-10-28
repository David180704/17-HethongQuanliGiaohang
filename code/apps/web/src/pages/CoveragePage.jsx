import { useEffect, useState } from "react";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { REGION_LABELS } from "../lib/format.js";
import UpdatedAt from "../components/UpdatedAt.jsx";

export default function CoveragePage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  // Doi 300ms sau phim go cuoi moi tim (khong goi API moi lan go mot phim).
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cung tu khoa trong 30 giay -> lay tu cache; man hinh dang mo tu lam moi moi 30 giay.
  const { data, loading, error: loadError, updatedAt, refresh } = useCachedQuery(
    "/public/service-areas",
    query ? { search: query } : {},
  );
  const areas = data || [];
  const error = loadError ? "Không tải được vùng phục vụ. Vui lòng thử lại sau." : "";

  const byProvince = new Map();
  for (const area of areas) {
    if (!byProvince.has(area.province)) byProvince.set(area.province, { region: area.region, districts: [] });
    byProvince.get(area.province).districts.push(area.district);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Vùng phục vụ</h1>
      <p className="mt-1 text-gray-600">
        Chỉ nhận đơn khi cả nơi gửi và nơi nhận đều thuộc các quận/huyện dưới đây.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nhập tỉnh hoặc quận/huyện, vd: Hoàn Kiếm"
        aria-label="Tìm vùng phục vụ"
        className="mt-6 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />

      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && (
        <p className="mt-4 text-sm text-gray-500" role="status">
          {areas.length > 0
            ? `${areas.length} quận/huyện tại ${byProvince.size} tỉnh/thành`
            : `Chưa phục vụ khu vực "${query}"`}
        </p>
      )}
      <div className="mt-1">
        <UpdatedAt date={updatedAt} onRefresh={refresh} />
      </div>

      <div className="mt-4 space-y-3">
        {[...byProvince.entries()].map(([province, info]) => (
          <section key={province} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{province}</h2>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {REGION_LABELS[info.region] || info.region}
              </span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {info.districts.map((district) => (
                <li key={district} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
                  {district}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
