import { useEffect, useRef, useState } from "react";
import { apiClient } from "../lib/apiClient.js";
import { REGION_LABELS } from "../lib/format.js";

export default function CoveragePage() {
  const [search, setSearch] = useState("");
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);

  // Doi 300ms sau phim go cuoi moi goi API; ket qua cu ve tre thi bo qua.
  useEffect(() => {
    const timer = setTimeout(() => {
      const seq = ++requestSeq.current;
      apiClient
        .get("/public/service-areas", { params: { search: search.trim() || undefined } })
        .then((res) => {
          if (seq !== requestSeq.current) return;
          setAreas(res.data.data);
          setError("");
        })
        .catch(() => {
          if (seq === requestSeq.current) setError("Không tải được vùng phục vụ. Vui lòng thử lại sau.");
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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
            : `Chưa phục vụ khu vực "${search.trim()}"`}
        </p>
      )}

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
