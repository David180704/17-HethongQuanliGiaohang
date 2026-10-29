import { useCachedQuery } from "../lib/useCachedQuery.js";
import { plainText } from "../lib/format.js";
import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";

// Dia chi Viet Nam: so nha/duong, tinh/thanh, quan/huyen, phuong/xa. Goi y tinh va
// quan/huyen lay tu vung phuc vu; khach go khong dau van duoc - server khop ten chuan
// va bao loi neu quan/huyen chua phuc vu. Dung cho dia diem lay hang va nguoi nhan.
export default function AddressFields({ idPrefix, value, onChange, addressLabel = "Địa chỉ (số nhà, đường)" }) {
  const { data } = useCachedQuery("/public/service-areas");
  const areas = data || [];
  const provinces = [...new Set(areas.map((area) => area.province))];
  const typedProvince = plainText(value.province);
  const districts = areas
    .filter((area) => !typedProvince || plainText(area.province) === typedProvince)
    .map((area) => area.district);

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
        <Field id={`${idPrefix}-province`} label="Tỉnh/Thành phố">
          {input("province", { list: `${idPrefix}-provinces`, autoComplete: "off" })}
          <datalist id={`${idPrefix}-provinces`}>
            {provinces.map((province) => (
              <option key={province} value={province} />
            ))}
          </datalist>
        </Field>
        <Field id={`${idPrefix}-district`} label="Quận/Huyện">
          {input("district", { list: `${idPrefix}-districts`, autoComplete: "off" })}
          <datalist id={`${idPrefix}-districts`}>
            {districts.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
        </Field>
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
