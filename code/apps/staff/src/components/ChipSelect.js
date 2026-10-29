import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

// Thay cho <select>: React Native khong co dropdown san, ma danh muc o day it
// lua chon (vai tro, mien, tuyen) nen bay het ra dang chip de bam 1 cham.
// multiple=true -> value la mang (vd routeIds cua tai xe).
// testID: moi chip nhan testID "<testID>-<value>" (vd field-status-LOCKED) de test
// tu dong bam dung chip, khong nham voi chu giong het o noi khac tren man hinh.
export default function ChipSelect({
  label,
  required = false,
  help,
  options,
  value,
  onChange,
  multiple = false,
  loading = false,
  testID,
}) {
  const selected = multiple ? (Array.isArray(value) ? value : []) : value;

  function toggle(optionValue) {
    if (!multiple) {
      onChange(optionValue);
      return;
    }
    onChange(
      selected.includes(optionValue) ? selected.filter((v) => v !== optionValue) : [...selected, optionValue],
    );
  }

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={styles.row} role={multiple ? "group" : "radiogroup"} aria-label={label}>
        {options.map((option) => {
          const active = multiple ? selected.includes(option.value) : selected === option.value;
          return (
            <Pressable
              key={String(option.value)}
              testID={testID ? `${testID}-${option.value}` : undefined}
              role={multiple ? "checkbox" : "radio"}
              aria-checked={active}
              aria-label={option.label}
              onPress={() => toggle(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
        {loading ? <Text style={styles.help}>Đang tải lựa chọn...</Text> : null}
        {!loading && options.length === 0 ? <Text style={styles.help}>Chưa có lựa chọn nào</Text> : null}
      </View>
      {help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  required: { color: colors.danger },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.primary, fontWeight: "600" },
  help: { fontSize: 12, color: colors.muted },
});
