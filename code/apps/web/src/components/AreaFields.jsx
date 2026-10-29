import { useCachedQuery } from "../lib/useCachedQuery.js";
import { plainText } from "../lib/format.js";
import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";

// Tinh/thanh + quan/huyen co goi y tu vung phuc vu (datalist). Go khong dau van
// duoc - server khop ten chuan va bao loi neu quan/huyen chua phuc vu.
export default function AreaFields({ idPrefix, value, onChange, labels = {} }) {
  const { data } = useCachedQuery("/public/service-areas");
  const areas = data || [];
  const provinces = [...new Set(areas.map((area) => area.province))];
  const typedProvince = plainText(value.province);
  const districts = areas
    .filter((area) => !typedProvince || plainText(area.province) === typedProvince)
    .map((area) => area.district);

  const input = (name) => (
    <input
      id={`${idPrefix}-${name}`}
      required
      value={value[name]}
      onChange={(e) => onChange({ [name]: e.target.value })}
      list={`${idPrefix}-${name}-list`}
      autoComplete="off"
      className={inputClass}
    />
  );

  return (
    <>
      <Field id={`${idPrefix}-province`} label={labels.province || "Tỉnh/Thành phố"}>
        {input("province")}
        <datalist id={`${idPrefix}-province-list`}>
          {provinces.map((province) => (
            <option key={province} value={province} />
          ))}
        </datalist>
      </Field>
      <Field id={`${idPrefix}-district`} label={labels.district || "Quận/Huyện"}>
        {input("district")}
        <datalist id={`${idPrefix}-district-list`}>
          {districts.map((district) => (
            <option key={district} value={district} />
          ))}
        </datalist>
      </Field>
    </>
  );
}
