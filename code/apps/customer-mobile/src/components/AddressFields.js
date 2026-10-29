import TextField from "./TextField";
import AreaFields from "./AreaFields";

// Dia chi Viet Nam day du: so nha/duong, quan/huyen (goi y theo vung phuc vu), tinh/thanh,
// phuong/xa. Server khop ten chuan va bao loi neu ngoai vung phuc vu.
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
      <TextField testID={`${idPrefix}-ward`} label="Phường/Xã" value={value.ward} onChangeText={(text) => onChange({ ward: text })} />
    </>
  );
}
