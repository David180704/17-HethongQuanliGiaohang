import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";
import AreaFields from "./AreaFields.jsx";

// Dia chi Viet Nam 2 cap (tu 01/07/2025): so nha/duong + tinh/thanh + xa/phuong (goi y va kiem
// theo danh muc hanh chinh that). Dung cho dia diem lay hang va nguoi nhan.
export default function AddressFields({ idPrefix, value, onChange, addressLabel = "Địa chỉ (số nhà, đường)" }) {
  return (
    <>
      <Field id={`${idPrefix}-address`} label={addressLabel}>
        <input
          id={`${idPrefix}-address`}
          required
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          autoComplete="street-address"
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <AreaFields idPrefix={idPrefix} value={value} onChange={onChange} />
      </div>
      <p className="text-xs text-gray-500">
        Địa giới mới (từ 01/07/2025): chỉ còn tỉnh/thành và xã/phường, không còn quận/huyện. Gõ không dấu cũng được,
        nhưng phải khớp danh sách gợi ý ·{" "}
        <a href="/vung-phuc-vu" target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
          vùng phục vụ
        </a>
      </p>
    </>
  );
}
