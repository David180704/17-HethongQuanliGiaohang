import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { GROUP_FILTERS, formatDateTime } from "../lib/orderView.js";
import { inputClass } from "../lib/ui.js";

// 4 nhom trang thai cua de 14, theo thu tu hanh trinh (bo "Tat ca" cua bo loc)
const STAGES = GROUP_FILTERS.filter((g) => g.code);

// US-22: tra cuu cong khai bang ma van don - khong can dang nhap. Khong tu lam moi (API gioi han 20 lan/phut);
// ma tren URL (?ma=) nen gui link cho nguoi nhan duoc.
export default function TrackingPage() {
  const [params, setParams] = useSearchParams();
  const code = (params.get("ma") || "").trim().toUpperCase();
  const [input, setInput] = useState(code);
  const [state, setState] = useState({ loading: false, data: null, error: "" });

  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;
    // Dong bo voi he thong ngoai (API): setState chi chay sau khi request tra ve
    // oxlint-disable-next-line react/set-state-in-effect
    setState({ loading: true, data: null, error: "" });
    apiClient
      .get(`/tracking/${encodeURIComponent(code)}`)
      .then((res) => !cancelled && setState({ loading: false, data: res.data.data, error: "" }))
      .catch((err) => !cancelled && setState({ loading: false, data: null, error: errorMessage(err, "Không tra cứu được đơn") }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  function submit(e) {
    e.preventDefault();
    const value = input.trim().toUpperCase();
    if (value) setParams({ ma: value });
  }

  const { data, loading, error } = state;
  const stageIndex = data ? STAGES.findIndex((s) => s.code === data.group) : -1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tra cứu đơn hàng</h1>
      <p className="mt-1 text-sm text-gray-500">Nhập mã vận đơn để xem đơn đang ở đâu — không cần đăng nhập.</p>

      <form role="search" onSubmit={submit} className="mt-6 flex gap-2">
        <label htmlFor="tracking-code" className="sr-only">
          Mã vận đơn
        </label>
        <input
          id="tracking-code"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ví dụ EXP1000000001"
          className={inputClass}
          autoComplete="off"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Tra cứu
        </button>
      </form>

      {loading && <p className="mt-6 text-gray-500">Đang tra cứu...</p>}
      {error && (
        <div role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <section aria-label="Kết quả tra cứu" className="mt-6 space-y-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Mã vận đơn</p>
              <p className="text-2xl font-extrabold tracking-wide text-brand-600">{data.trackingCode}</p>
              <p className="text-sm text-gray-500">{data.serviceName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{data.groupLabel}</p>
              <p className="text-sm text-gray-500">{data.statusLabel}</p>
            </div>
          </div>

          <ol aria-label="Trạng thái đơn" className="grid grid-cols-4 gap-2 text-center text-xs">
            {STAGES.map((stage, index) => (
              <li
                key={stage.code}
                aria-current={index === stageIndex ? "step" : undefined}
                className={`rounded-lg px-2 py-2 font-semibold ${
                  index < stageIndex
                    ? "bg-brand-50 text-brand-600"
                    : index === stageIndex
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {stage.label}
              </li>
            ))}
          </ol>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500">Người gửi: </span>
              {data.sender.name}
            </p>
            <p>
              <span className="text-gray-500">Giao đến: </span>
              {data.receiver.ward}, {data.receiver.province} · {data.receiver.phone}
            </p>
          </div>

          <div>
            <h2 className="font-semibold">Hành trình</h2>
            <ol aria-label="Hành trình" className="mt-3 space-y-3">
              {[...data.events].reverse().map((event, index) => (
                <li key={`${event.status}-${event.at}`} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${index === 0 ? "bg-brand-600 ring-4 ring-brand-100" : "bg-gray-300"}`}
                  />
                  <div>
                    <p className={`text-sm ${index === 0 ? "font-semibold" : "text-gray-700"}`}>{event.label}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(event.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {data.checkins?.length ? (
            <div>
              <h2 className="font-semibold">Đã đi qua</h2>
              <ul aria-label="Điểm check-in đã qua" className="mt-2 space-y-1 text-sm text-gray-700">
                {data.checkins.map((checkin) => (
                  <li key={`${checkin.point}-${checkin.at}`}>
                    {checkin.point} <span className="text-xs text-gray-500">· {formatDateTime(checkin.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
