import { useEffect, useRef } from "react";
import { useAddressCheck } from "../lib/adminUnits.js";
import { inputClass } from "../lib/ui.js";
import { Field } from "./AuthShell.jsx";

// Tinh/thanh + xa/phuong (dia gioi tu 01/07/2025, khong con quan/huyen), goi y tu danh muc that.
// Go tay cung duoc nhung phai khop danh muc: sai thi bao do va form khong gui duoc (setCustomValidity);
// roi o nhap thi tu doi ve ten chuan ("ba dinh" -> "Phường Ba Đình").
export default function AreaFields({ idPrefix, value, onChange, labels = {} }) {
  const check = useAddressCheck(value.province, value.ward);
  const provinceRef = useRef(null);
  const wardRef = useRef(null);

  useEffect(() => {
    provinceRef.current?.setCustomValidity(check.provinceError);
    wardRef.current?.setCustomValidity(check.wardError);
  }, [check.provinceError, check.wardError]);

  const normalize = (name, canonical) => {
    if (canonical && canonical !== value[name]) onChange({ [name]: canonical });
  };

  const input = (name, ref, error, canonical, props = {}) => (
    <>
      <input
        ref={ref}
        id={`${idPrefix}-${name}`}
        required
        value={value[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
        onBlur={() => normalize(name, canonical)}
        list={`${idPrefix}-${name}-list`}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${idPrefix}-${name}-error` : undefined}
        className={`${inputClass} ${error ? "border-red-400" : ""}`}
        {...props}
      />
      {error && (
        <p id={`${idPrefix}-${name}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </>
  );

  return (
    <>
      <Field id={`${idPrefix}-province`} label={labels.province || "Tỉnh/Thành phố"}>
        {input("province", provinceRef, check.provinceError, check.province?.name)}
        <datalist id={`${idPrefix}-province-list`}>
          {check.provinces.map((province) => (
            <option key={province.name} value={province.name} />
          ))}
        </datalist>
      </Field>
      <Field id={`${idPrefix}-ward`} label={labels.ward || "Xã/Phường"}>
        {input("ward", wardRef, check.wardError, check.ward, {
          placeholder: check.province ? `${check.wards.length || "…"} xã/phường của ${check.province.name}` : "Chọn tỉnh/thành trước",
        })}
        <datalist id={`${idPrefix}-ward-list`}>
          {check.wards.map((ward) => (
            <option key={ward.name} value={ward.name} />
          ))}
        </datalist>
      </Field>
    </>
  );
}
