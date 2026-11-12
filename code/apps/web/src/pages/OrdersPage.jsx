import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage } from "../lib/apiClient.js";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { formatVnd } from "../lib/format.js";
import { GROUP_FILTERS, formatDateTime } from "../lib/orderView.js";
import { inputClass } from "../lib/ui.js";
import StatusBadge from "../components/order/StatusBadge.jsx";
import UpdatedAt from "../components/UpdatedAt.jsx";

const PAGE_SIZE = 10;

// US-20: danh sach don cua khach, loc theo nhom trang thai (de 14), khoang ngay tao, tim ma van don /
// nguoi nhan. Bo loc nam tren URL nen tai lai trang hay bam quay lai van giu.
export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const search = params.get("q") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [searchText, setSearchText] = useState(search);
  const query = { group, from, to, search, page, limit: PAGE_SIZE };
  const { data: orders, meta, loading, error, updatedAt, refresh } = useCachedQuery("/orders", query);
  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / PAGE_SIZE));
  const filtered = Boolean(group || from || to || search);

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchText("");
    setParams(new URLSearchParams(), { replace: true });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Đơn hàng của tôi</h1>
          <p className="mt-1 text-sm text-gray-500">Theo dõi trạng thái và hành trình từng đơn.</p>
        </div>
        <Link to="/tao-don" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          + Tạo đơn
        </Link>
      </div>

      <section aria-label="Bộ lọc đơn hàng" className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Nhóm trạng thái">
          {GROUP_FILTERS.map((item) => (
            <button
              key={item.code || "all"}
              type="button"
              aria-pressed={group === item.code}
              onClick={() => update({ group: item.code })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                group === item.code ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
          <div>
            <label htmlFor="orders-from" className="mb-1 block text-sm font-medium text-gray-700">
              Từ ngày
            </label>
            <input id="orders-from" type="date" value={from} onChange={(e) => update({ from: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="orders-to" className="mb-1 block text-sm font-medium text-gray-700">
              Đến ngày
            </label>
            <input id="orders-to" type="date" value={to} onChange={(e) => update({ to: e.target.value })} className={inputClass} />
          </div>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: searchText.trim() });
            }}
          >
            <label htmlFor="orders-search" className="mb-1 block text-sm font-medium text-gray-700">
              Tìm đơn
            </label>
            <div className="flex gap-2">
              <input
                id="orders-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Mã vận đơn, tên hoặc số điện thoại người nhận"
                className={inputClass}
              />
              <button type="submit" className="shrink-0 rounded-lg border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50">
                Tìm
              </button>
            </div>
          </form>
        </div>
        {filtered && (
          <button type="button" onClick={clearFilters} className="text-sm font-medium text-brand-600 hover:underline">
            Bỏ lọc
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage(error, "Không tải được danh sách đơn")}
        </div>
      )}
      {loading && !orders && <p className="mt-6 text-gray-500">Đang tải...</p>}

      {orders && (
        <>
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span>{meta?.total ?? 0} đơn</span>
            <UpdatedAt date={updatedAt} onRefresh={refresh} />
          </div>
          {orders.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
              {filtered ? "Không có đơn nào phù hợp bộ lọc." : "Bạn chưa có đơn hàng nào."}
            </div>
          ) : (
            <ul aria-label="Danh sách đơn hàng" className="mt-3 space-y-3">
              {orders.map((order) => (
                <li key={order._id}>
                  <Link
                    to={`/don-hang/${order._id}`}
                    className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-brand-500 sm:grid-cols-[1.2fr_1.6fr_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-bold tracking-wide text-brand-600">{order.trackingCode}</p>
                      <p className="text-xs text-gray-500">Tạo {formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{order.receiver.name}</p>
                      <p className="text-gray-500">
                        {order.receiver.ward}, {order.receiver.province}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold">{formatVnd(order.fee.total)}</p>
                      {order.cod?.enabled && <p className="text-gray-500">Thu hộ {formatVnd(order.cod.amount)}</p>}
                    </div>
                    <StatusBadge display={order.display} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <nav aria-label="Phân trang" className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
              >
                ← Trước
              </button>
              <span>
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => update({ page: String(page + 1) })}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
              >
                Sau →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
