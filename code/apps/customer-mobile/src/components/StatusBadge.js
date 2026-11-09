import { StyleSheet, Text, View } from "react-native";
import { GROUP_COLORS } from "../lib/orderView";
import { colors } from "../theme";

// Nhom trang thai cua khach (4 nhom de 14) kem ten trang thai chi tiet ben duoi (US-20).
export default function StatusBadge({ display, testID }) {
  if (!display) return null;
  const palette = GROUP_COLORS[display.group] || GROUP_COLORS.NOT_RECEIVED;
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.badge, { backgroundColor: palette.bg, color: palette.fg }]}>{display.groupLabel}</Text>
      <Text style={styles.detail}>{display.statusLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-end", gap: 2, flexShrink: 1 },
  badge: { fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  detail: { fontSize: 12, color: colors.muted, textAlign: "right" },
});
