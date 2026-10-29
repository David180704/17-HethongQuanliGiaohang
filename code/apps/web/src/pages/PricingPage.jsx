import { useState } from "react";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { ZONES, formatTier, formatVnd, formatSurcharge, tierAllowsExtraSteps } from "../lib/format.js";
import UpdatedAt from "../components/UpdatedAt.jsx";

// Gia hien thi = cuoc co ban x (1 + he so phu phi dich vu). STANDARD va EXPRESS
// dung chung bac khoi luong (CLAUDE.md muc 5) - chenh lech nam o phu phi dich vu.
export default function PricingPage() {
  const [serviceCode, setServiceCode] = useState("STANDARD");
  const { data, loading, error: loadError, updatedAt, refresh } = useCachedQuery("/public/price-tables");
  const tables = data || [];
  const error = loadError ? "Không tải được bảng giá. Vui lòng thử lại sau." : "";

  const serviceTypes = [];
  for (const table of tables) {
    const type = table.serviceTypeId;
    if (type && !serviceTypes.some((t) => t.code === type.code)) serviceTypes.push(type);
  }
  serviceTypes.sort((a, b) => a.surchargeRate - b.surchargeRate);
  const selectedType = serviceTypes.find((t) => t.code === serviceCode) || serviceTypes[0];
  const rate = selectedType?.surchargeRate || 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">Bảng giá vận chuyển</h1>
      <p className="mt-1 text-gray-600">
        Giá theo vùng gửi – nhận và khối lượng tính cước. Khối lượng tính cước là số lớn hơn giữa khối lượng thật và
        khối lượng quy đổi (dài × rộng × cao ÷ 5000).
      </p>
      <div className="mt-2">
        <UpdatedAt date={updatedAt} onRefresh={refresh} />
      </div>

      {error && <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="mt-6 text-gray-500">Đang tải bảng giá...</p>}

      {serviceTypes.length > 0 && (
        <>
          <div className="mt-6 inline-flex rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Loại dịch vụ">
            {serviceTypes.map((type) => {
              const active = type.code === selectedType.code;
              return (
                <button
                  key={type.code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setServiceCode(type.code)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {type.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-gray-500">{formatSurcharge(rate)} — giá dưới đây đã gồm phụ phí này.</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ZONES.map((zone) => {
              const table = tables.find((t) => t.zone === zone.code && t.serviceTypeId?.code === selectedType.code);
              return (
                <section key={zone.code} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <header className="border-b border-gray-100 px-4 py-3">
                    <h2 className="font-semibold">{zone.label}</h2>
                    <p className="text-xs text-gray-500">{zone.hint}</p>
                  </header>
                  {table ? (
                    <ul className="divide-y divide-gray-100">
                      {table.weightTiers.map((tier) => (
                        <li key={tier.fromGram} className="flex items-baseline justify-between gap-2 px-4 py-2.5">
                          <span className="text-sm text-gray-600">{formatTier(tier)}</span>
                          <span className="text-right">
                            <span className="block font-semibold">{formatVnd(tier.basePrice * (1 + rate))}</span>
                            {tierAllowsExtraSteps(tier) && (
                              <span className="block text-xs text-gray-500">
                                +{formatVnd(tier.pricePer500g)} mỗi 500 g vượt
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-gray-500">Chưa có bảng giá</p>
                  )}
                </section>
              );
            })}
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Hàng dễ vỡ, hàng giá trị cao có phụ phí đặc biệt. Phí chính xác hiển thị khi tạo đơn và được khóa lại khi
            đơn được xác nhận.
          </p>
        </>
      )}
    </div>
  );
}
