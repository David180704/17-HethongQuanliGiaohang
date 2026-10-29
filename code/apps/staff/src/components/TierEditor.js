import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme";

// Luoi bac khoi luong cua bang gia (US-13): moi dong = mot bac [Tu g, Den g) + gia.
// Gia tri giu dang chuoi trong luc go; ResourceForm.buildPayload doi sang so khi Luu.
const COLUMNS = [
  { key: "fromGram", label: "Từ (g)" },
  { key: "toGram", label: "Đến (g)" },
  { key: "basePrice", label: "Giá cơ bản" },
  { key: "pricePer500g", label: "+ mỗi 500 g" },
];

export const emptyTier = () => ({ fromGram: "", toGram: "", basePrice: "", pricePer500g: "" });

export default function TierEditor({ label, help, value = [], onChange, testID }) {
  const rows = value.length ? value : [emptyTier()];

  const setCell = (index, key, text) => onChange(rows.map((row, i) => (i === index ? { ...row, [key]: text } : row)));
  // Dong moi bat dau dung tai "Den" cua dong cuoi: bac noi tiep, khong ho khoang trong
  const addRow = () => onChange([...rows, { ...emptyTier(), fromGram: rows[rows.length - 1]?.toGram ?? "" }]);
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>
        {label}
        <Text style={styles.required}> *</Text>
      </Text>
      <View style={styles.headerRow}>
        {COLUMNS.map((c) => (
          <Text key={c.key} style={styles.headerCell}>
            {c.label}
          </Text>
        ))}
        <View style={styles.removeSpace} />
      </View>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {COLUMNS.map((c) => (
            <TextInput
              key={c.key}
              testID={`${testID}-${index}-${c.key}`}
              aria-label={`Bậc ${index + 1} - ${c.label}`}
              value={String(row[c.key] ?? "")}
              onChangeText={(text) => setCell(index, c.key, text)}
              keyboardType="decimal-pad"
              style={styles.cell}
            />
          ))}
          <Pressable
            testID={`${testID}-${index}-remove`}
            role="button"
            aria-label={`Xóa bậc ${index + 1}`}
            onPress={() => removeRow(index)}
            disabled={rows.length === 1}
            style={[styles.remove, rows.length === 1 && styles.disabled]}
          >
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable testID={`${testID}-add`} role="button" onPress={addRow} style={styles.add}>
        <Text style={styles.addText}>+ Thêm bậc</Text>
      </Pressable>
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  required: { color: colors.danger },
  headerRow: { flexDirection: "row", gap: 6 },
  headerCell: { flex: 1, fontSize: 12, color: colors.muted, fontWeight: "600" },
  row: { flexDirection: "row", gap: 6, alignItems: "center" },
  cell: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  removeSpace: { width: 32 },
  remove: { width: 32, height: 36, alignItems: "center", justifyContent: "center" },
  removeText: { fontSize: 20, color: colors.danger },
  disabled: { opacity: 0.3 },
  add: { alignSelf: "flex-start", paddingVertical: 6 },
  addText: { color: colors.primary, fontWeight: "600" },
  help: { fontSize: 12, color: colors.muted },
});
