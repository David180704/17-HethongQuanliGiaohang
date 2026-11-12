import { StyleSheet, Text, View } from "react-native";
import TextField from "./TextField";
import { Toggle } from "./Choice";
import { colors } from "../theme";

// Kien hang: khoi luong (g), kich thuoc (cm), gia tri khai bao, hang dac biet.
export default function ParcelFields({ idPrefix, value, onChange }) {
  const number = (name, label, props = {}) => (
    <TextField
      testID={`${idPrefix}-${name}`}
      label={label}
      value={String(value[name] ?? "")}
      onChangeText={(text) => onChange({ [name]: text })}
      keyboardType="number-pad"
      style={props.half ? styles.half : undefined}
    />
  );
  return (
    <>
      {number("weightGram", "Khối lượng (g)")}
      <View style={styles.row}>
        {number("length", "Dài (cm)", { half: true })}
        {number("width", "Rộng (cm)", { half: true })}
        {number("height", "Cao (cm)", { half: true })}
      </View>
      {number("declaredValue", "Giá trị hàng khai báo (đ)")}
      <Text style={styles.label}>Hàng đặc biệt</Text>
      <Toggle testID={`${idPrefix}-fragile`} label="Hàng dễ vỡ (+5.000 đ)" value={value.fragile} onChange={(v) => onChange({ fragile: v })} />
      <Toggle testID={`${idPrefix}-isVehicle`} label="Xe máy, xe điện (+50.000 đ)" value={value.isVehicle} onChange={(v) => onChange({ isVehicle: v })} />
      <Text style={styles.hint}>Khai giá từ 5.000.000 đ tự tính hàng giá trị cao (+10.000 đ).</Text>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
});
