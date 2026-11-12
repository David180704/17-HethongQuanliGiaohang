import { useState } from "react";
import { Link } from "react-router-dom";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { formatVnd } from "../lib/format.js";
import UpdatedAt from "../components/UpdatedAt.jsx";

const day = (value) => new Date(value).toLocaleDateString("vi-VN");

// US-43 (de 02): shop theo doi doi soat - tung ky, don trong ky, tong thu ho, tong phi, khoan dieu chinh, so tien
// thuc nhan va giao dich chi tra khi Express da chuyen tien.
export default function SettlementsPage() {
  const { data, loading, updatedAt, refresh } = useCachedQuery("/settlements");
  const [open, setOpen] = useState("");
  const settlements = data || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Đối soát</h1>
      <p className="mt-1 text-gray-600">
        Express tổng hợp định kỳ các đơn đã giao / đã hoàn: tiền thu hộ, phí bị trừ, khoản điều chỉnh và số tiền chuyển vào tài khoản bạn đã khai báo ở{" "}
        <Link to="/tai-khoan" className="font-medium text-brand-600 hover:underline">
          Tài khoản
        </Link>
        .
      </p>
      <div className="mt-2">
        <UpdatedAt date={updatedAt} onRefresh={refresh} />
      </div>
      {loading && <p className="mt-4 text-gray-500">Đang tải...</p>}
      {!loading && settlements.length === 0 && <p className="mt-6 text-gray-500">Chưa có kỳ đối soát nào.</p>}
      <div className="mt-4 space-y-3">
        {settlements.map((s) => (
          <section key={s._id} aria-label={`Kỳ ${s.code}`} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">
                {s.code} · {day(s.periodFrom)} – {day(s.periodTo)}
              </h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status === "PAID" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                {s.status === "PAID" ? "Đã chi trả" : "Chờ chi trả"}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Item label="Số đơn" value={s.orderCount} />
              <Item label="Tổng thu hộ" value={formatVnd(s.totals.cod)} />
              <Item label="Phí bị trừ" value={formatVnd(s.totals.feeDeducted)} />
              <Item label="Điều chỉnh" value={formatVnd(s.totals.adjustments)} />
              <Item label="Thực nhận" value={formatVnd(s.totals.netPayable)} strong />
            </dl>
            {s.payment?.txnRef && (
              <p className="mt-2 text-sm text-green-700" role="status">
                Đã chuyển {formatVnd(s.payment.amount)} vào {s.payment.bankName} {s.payment.accountNumber} · mã GD {s.payment.txnRef}
              </p>
            )}
            <button type="button" onClick={() => setOpen(open === s._id ? "" : s._id)} className="mt-3 text-sm font-medium text-brand-600 hover:underline">
              {open === s._id ? "Thu gọn" : "Xem từng đơn"}
            </button>
            {open === s._id && <Detail id={s._id} />}
          </section>
        ))}
      </div>
    </div>
  );
}

function Item({ label, value, strong }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className={strong ? "text-base font-bold text-brand-600" : "font-medium"}>{value}</dd>
    </div>
  );
}

function Detail({ id }) {
  const { data } = useCachedQuery(`/settlements/${id}`);
  if (!data) return <p className="mt-2 text-sm text-gray-500">Đang tải...</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm" aria-label="Đơn trong kỳ">
        <thead className="text-gray-500">
          <tr>
            <th className="py-1 pr-3">Mã vận đơn</th>
            <th className="py-1 pr-3">Kết quả</th>
            <th className="py-1 pr-3 text-right">Thu hộ</th>
            <th className="py-1 text-right">Phí bị trừ</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l) => (
            <tr key={l.trackingCode} className="border-t border-gray-100">
              <td className="py-1 pr-3">{l.trackingCode}</td>
              <td className="py-1 pr-3">{l.status === "RETURNED" ? "Đã hoàn" : "Đã giao"}</td>
              <td className="py-1 pr-3 text-right">{formatVnd(l.codCollected)}</td>
              <td className="py-1 text-right">{formatVnd(l.feeDeducted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.adjustments.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-label="Khoản điều chỉnh">
          {data.adjustments.map((a) => (
            <li key={`${a.reason}-${a.at}`}>
              {a.amount > 0 ? "+" : ""}
              {formatVnd(a.amount)} · {a.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
