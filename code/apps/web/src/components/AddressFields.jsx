import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";
import AreaFields from "./AreaFields.jsx";

// Dia chi Viet Nam day du: so nha/duong + tinh/thanh, quan/huyen (goi y theo vung
// phuc vu) + phuong/xa. Dung cho dia diem lay hang va nguoi nhan.
export default function AddressFields({ idPrefix, value, onChange, addressLabel = "Địa chỉ (số nhà, đường)" }) {
  const input = (name, props = {}) => (
    <input
      id={`${idPrefix}-${name}`}
      required
      value={value[name]}
      onChange={(e) => onChange({ [name]: e.target.value })}
      className={inputClass}
      {...props}
    />
  );

  return (
    <>
      <Field id={`${idPrefix}-address`} label={addressLabel}>
        {input("address", { autoComplete: "street-address" })}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <AreaFields idPrefix={idPrefix} value={value} onChange={onChange} />
        <Field id={`${idPrefix}-ward`} label="Phường/Xã">
          {input("ward")}
        </Field>
      </div>
      <p className="text-xs text-gray-500">
        Chỉ nhận quận/huyện thuộc{" "}
        <a href="/vung-phuc-vu" target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
          vùng phục vụ
        </a>
        .
      </p>
    </>
  );
}
