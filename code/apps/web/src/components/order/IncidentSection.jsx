import { useState } from "react";
import { apiClient, errorMessage } from "../../lib/apiClient.js";
import { useCachedQuery } from "../../lib/useCachedQuery.js";
import { queryCache } from "../../lib/queryCache.js";
import { formatVnd } from "../../lib/format.js";
import { formatDateTime } from "../../lib/orderView.js";
import { inputClass } from "../../lib/ui.js";

const STATUS_TONE = { OPEN: "bg-red-50 text-red-700", IN_PROGRESS: "bg-amber-50 text-amber-800", RESOLVED: "bg-green-50 text-green-700" };

// US-38 (de 02): shop bao su co / khieu nai cho don cua minh va theo doi tinh trang xu ly, ket qua giai quyet.
export default function IncidentSection({ orderId, onChanged }) {
  const { data: incidents, refresh } = useCachedQuery("/incidents", { orderId });
  const { data: types } = useCachedQuery("/incidents/types");
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ busy: false, error: "", message: "" });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: "", message: "" });
    try {
      const res = await apiClient.post("/incidents", { orderId, type: form.type, description: form.description });
      queryCache.invalidate("/incidents");
      queryCache.invalidate("/orders");
      setForm(null);
      setState({ busy: false, error: "", message: `Đã gửi ${res.data.data.code} — Express sẽ xử lý và cập nhật kết quả tại đây` });
      refresh();
      onChanged?.();
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), message: "" });
    }
  }

  return (
    <section aria-label="Sự cố, khiếu nại" className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Sự cố, khiếu nại</h2>
        {!form && (
          <button type="button" onClick={() => setForm({ type: "", description: "" })} className="rounded-lg border border-brand-600 px-3 py-1.5 font-medium text-brand-600 hover:bg-brand-50">
            Báo sự cố / khiếu nại
          </button>
        )}
      </div>
      {state.message && <p role="status" className="mt-2 text-green-700">{state.message}</p>}
      {form && (
        <form onSubmit={submit} className="mt-3 space-y-3" aria-label="Báo sự cố">
          <label className="block">
            <span className="mb-1 block font-medium">Loại sự cố</span>
            <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClass}>
              <option value="">— Chọn —</option>
              {(types || []).filter((t) => t.value !== "RECIPIENT_COMPLAINT").map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Nội dung</span>
            <textarea required minLength={10} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </label>
          {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={state.busy} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              Gửi
            </button>
            <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-gray-300 px-4 py-2">
              Hủy
            </button>
          </div>
        </form>
      )}
      {incidents?.length ? (
        <ul className="mt-3 space-y-3">
          {incidents.map((i) => (
            <li key={i._id} className="rounded-lg border border-gray-100 p-3" aria-label={`Sự cố ${i.code}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {i.code} · {i.typeLabel}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[i.status]}`}>{i.statusLabel}</span>
              </div>
              <p className="mt-1 text-gray-700">{i.description}</p>
              {i.history.slice(1).map((h) => (
                <p key={`${h.status}-${h.at}`} className="mt-1 text-xs text-gray-500">
                  {formatDateTime(h.at)} · {h.label}: {h.note}
                </p>
              ))}
              {i.resolution?.compensation > 0 && (
                <p className="mt-1 text-xs font-medium text-green-700">Bồi thường {formatVnd(i.resolution.compensation)} — cộng vào kỳ đối soát</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !form && <p className="mt-2 text-gray-500">Chưa có sự cố nào với đơn này.</p>
      )}
    </section>
  );
}
