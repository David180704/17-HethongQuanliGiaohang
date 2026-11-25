import { useState } from "react";
import { apiClient, errorMessage } from "../lib/apiClient.js";
import { queryCache } from "../lib/queryCache.js";
import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";
import AddressFields from "./AddressFields.jsx";

const EMPTY = { label: "", contactName: "", contactPhone: "", address: "", province: "", ward: "" };

// Them / sua dia diem lay hang (US-15). Dung o trang "Dia diem lay hang" va buoc 1
// cua tao don. Server tu xac dinh khu vuc phuc vu; ngoai vung thi bao loi ngay tren form.
export default function PickupLocationForm({ initial, onSaved, onCancel, submitLabel = "Lưu địa điểm" }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...pick(initial) }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));
  const input = (name, props = {}) => (
    <input id={`pl-${name}`} required value={form[name]} onChange={set(name)} className={inputClass} {...props} />
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = isEdit
        ? await apiClient.put(`/pickupLocations/${initial._id}`, form)
        : await apiClient.post("/pickupLocations", form);
      queryCache.invalidate("/pickupLocations");
      onSaved?.(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không lưu được địa điểm"));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={isEdit ? "Sửa địa điểm lấy hàng" : "Thêm địa điểm lấy hàng"}>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <Field id="pl-label" label="Tên gợi nhớ" hint="Ví dụ: Kho chính, Cửa hàng Cầu Giấy">
        {input("label")}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pl-contactName" label="Người liên hệ">
          {input("contactName", { autoComplete: "name" })}
        </Field>
        <Field id="pl-contactPhone" label="Số điện thoại liên hệ">
          {input("contactPhone", { type: "tel", autoComplete: "tel" })}
        </Field>
      </div>
      <AddressFields idPrefix="pl" value={form} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50">
            Hủy
          </button>
        )}
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? "Đang lưu..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function pick(location) {
  if (!location) return {};
  return Object.fromEntries(Object.keys(EMPTY).map((key) => [key, location[key] ?? ""]));
}
