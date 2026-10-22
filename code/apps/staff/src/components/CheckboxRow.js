import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export default function CheckboxRow({ label, value, onChange }) {
  const checked = Boolean(value);
  return (
    <Pressable role="checkbox" aria-checked={checked} aria-label={label} onPress={() => onChange(!checked)} style={styles.row}>
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  label: { fontSize: 15, color: colors.text },
});
