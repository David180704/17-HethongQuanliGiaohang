import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";

// Kien hang: khoi luong (g), kich thuoc (cm), gia tri khai bao va hang dac biet.
// Gia tri tu 5.000.000 d server tu tinh la hang gia tri cao.
export default function ParcelFields({ idPrefix, value, onChange }) {
  const number = (name, label, props = {}) => (
    <Field id={`${idPrefix}-${name}`} label={label}>
      <input
        id={`${idPrefix}-${name}`}
        type="number"
        inputMode="numeric"
        min="0"
        required={name !== "declaredValue"}
        value={value[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
        className={inputClass}
        {...props}
      />
    </Field>
  );
  const flag = (name, label) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={Boolean(value[name])} onChange={(e) => onChange({ [name]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        {number("weightGram", "Khối lượng (g)", { min: "1" })}
        {number("length", "Dài (cm)", { min: "1" })}
        {number("width", "Rộng (cm)", { min: "1" })}
        {number("height", "Cao (cm)", { min: "1" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {number("declaredValue", "Giá trị hàng khai báo (đ)")}
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-gray-700">Hàng đặc biệt</legend>
          {flag("fragile", "Hàng dễ vỡ (+5.000 đ)")}
          {flag("isVehicle", "Xe máy, xe điện (+50.000 đ)")}
          <p className="text-xs text-gray-500">Khai giá từ 5.000.000 đ tự tính hàng giá trị cao (+10.000 đ).</p>
        </fieldset>
      </div>
    </>
  );
}
