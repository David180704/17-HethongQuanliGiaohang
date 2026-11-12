import TextField from "./TextField";
import AreaFields from "./AreaFields";

// Dia chi Viet Nam 2 cap (tu 01/07/2025): so nha/duong + tinh/thanh + xa/phuong (goi y va kiem theo
// danh muc hanh chinh that). Server cung kiem lai va bao loi neu ngoai vung phuc vu.
export default function AddressFields({ idPrefix, value, onChange, addressLabel = "Địa chỉ (số nhà, đường)" }) {
  return (
    <>
      <TextField
        testID={`${idPrefix}-address`}
        label={addressLabel}
        value={value.address}
        onChangeText={(text) => onChange({ address: text })}
      />
      <AreaFields idPrefix={idPrefix} value={value} onChange={onChange} />
    </>
  );
}
