import { useEffect, useState } from "react";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { plainText } from "../lib/format.js";
import UpdatedAt from "../components/UpdatedAt.jsx";

// Vung phuc vu theo dia gioi 2 cap (tu 01/07/2025): chi tai 34 tinh/thanh (nhe); bam vao tinh nao
// moi tai xa/phuong cua tinh do. Tim theo ten xa/phuong thi goi API tim kiem (toi da 50 ket qua).
export default function CoveragePage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error: loadError, updatedAt, refresh } = useCachedQuery("/public/provinces");
  const provinces = data || [];
  const served = provinces.filter((p) => p.servedCount > 0);
  const totalWards = served.reduce((sum, p) => sum + p.servedCount, 0);
  const typed = plainText(query);
  const shown = typed ? served.filter((p) => plainText(p.name).includes(typed) || plainText(p.fullName).includes(typed)) : served;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Vùng phục vụ</h1>
      <p className="mt-1 text-gray-600">
        Địa giới mới từ 01/07/2025: 34 tỉnh/thành, không còn quận/huyện. Bấm vào tỉnh/thành để xem xã/phường đang phục vụ.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Nhập tỉnh/thành hoặc xã/phường, vd: Hà Nội, Ba Đình"
        aria-label="Tìm vùng phục vụ"
        className="mt-6 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />

      {loadError && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Không tải được vùng phục vụ. Vui lòng thử lại sau.</div>}

      {!loading && !loadError && (
        <p className="mt-4 text-sm text-gray-500" role="status">
          {totalWards.toLocaleString("vi-VN")} xã/phường tại {served.length} tỉnh/thành
        </p>
      )}
      <div className="mt-1">
        <UpdatedAt date={updatedAt} onRefresh={refresh} />
      </div>

      {query && <WardSearch query={query} />}

      <div className="mt-4 space-y-2">
        {shown.map((province) => (
          <section key={province.name} className="rounded-xl border border-gray-200 bg-white" aria-label={province.name}>
            <button
              type="button"
              aria-expanded={open === province.name}
              onClick={() => setOpen(open === province.name ? "" : province.name)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            >
              <h2 className="font-semibold">{province.name}</h2>
              <span className="text-sm text-gray-500">
                {province.servedCount}/{province.wardCount} xã/phường {open === province.name ? "▲" : "▼"}
              </span>
            </button>
            {open === province.name && <ProvinceWards province={province.name} />}
          </section>
        ))}
      </div>
    </div>
  );
}

// Chi goi API khi tinh duoc mo
function ProvinceWards({ province }) {
  const { data, loading } = useCachedQuery("/public/provinces/wards", { province });
  if (loading) return <p className="px-4 pb-4 text-sm text-gray-500">Đang tải...</p>;
  const wards = (data?.wards || []).filter((w) => w.served);
  return (
    <ul className="flex flex-wrap gap-2 px-4 pb-4" aria-label={`Xã/phường của ${province}`}>
      {wards.map((ward) => (
        <li key={ward.name} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
          {ward.name}
        </li>
      ))}
    </ul>
  );
}

function WardSearch({ query }) {
  const { data, loading } = useCachedQuery("/public/service-areas", { search: query });
  if (loading) return null;
  const found = data || [];
  return (
    <section className="mt-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4" aria-label="Xã/phường tìm thấy">
      <h2 className="text-sm font-semibold">
        {found.length ? `Xã/phường khớp “${query}”` : `Chưa phục vụ xã/phường nào khớp “${query}”`}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {found.map((area) => (
          <li key={`${area.province}|${area.ward}`} className="rounded-full bg-white px-3 py-1 text-sm text-brand-700">
            {area.ward}, {area.province}
          </li>
        ))}
      </ul>
    </section>
  );
}
