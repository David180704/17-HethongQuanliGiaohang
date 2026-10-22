import { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient.js";

// fields: [{ name, label, type: text|number|password|checkbox|select,
//   required, options: [{value,label}], optionsFrom: { endpoint, labelKey },
//   showIf: (values) => bool, help }]
export default function ResourceForm({ fields, initialValues, onSubmit, onCancel, submitLabel }) {
  const [values, setValues] = useState(() => initialValues || {});
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fields
      .filter((f) => f.optionsFrom)
      .forEach((f) => {
        apiClient.get(f.optionsFrom.endpoint, { params: { limit: 100 } }).then((res) => {
          setDynamicOptions((prev) => ({ ...prev, [f.name]: res.data.data }));
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Co loi xay ra, thu lai sau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {fields.map((f) => {
        if (f.showIf && !f.showIf(values)) return null;

        const commonLabel = (
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
          </label>
        );

        if (f.type === "checkbox") {
          return (
            <div key={f.name} className="flex items-center gap-2">
              <input
                id={f.name}
                type="checkbox"
                checked={Boolean(values[f.name])}
                onChange={(e) => setField(f.name, e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor={f.name} className="text-sm text-gray-700">
                {f.label}
              </label>
            </div>
          );
        }

        if (f.type === "select") {
          const options = f.optionsFrom
            ? (dynamicOptions[f.name] || []).map((item) => ({
                value: item[f.optionsFrom.valueKey || "_id"],
                label: f.optionsFrom.labelKey(item),
              }))
            : f.options || [];
          return (
            <div key={f.name}>
              {commonLabel}
              <select
                required={f.required}
                value={values[f.name] ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- Chọn --</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {f.help && <p className="mt-1 text-xs text-gray-500">{f.help}</p>}
            </div>
          );
        }

        return (
          <div key={f.name}>
            {commonLabel}
            <input
              type={f.type || "text"}
              required={f.required}
              placeholder={f.placeholder}
              value={values[f.name] ?? ""}
              onChange={(e) =>
                setField(f.name, f.type === "number" ? Number(e.target.value) : e.target.value)
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {f.help && <p className="mt-1 text-xs text-gray-500">{f.help}</p>}
          </div>
        );
      })}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : submitLabel || "Lưu"}
        </button>
      </div>
    </form>
  );
}
