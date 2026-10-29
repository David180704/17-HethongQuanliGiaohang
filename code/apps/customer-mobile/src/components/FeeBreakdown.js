import { StyleSheet, Text, View } from "react-native";
import { formatVnd } from "../lib/format";
import { colors } from "../theme";

const LINES = [
  ["base", "Cước cơ bản"],
  ["weightSurcharge", "Phụ phí khối lượng"],
  ["serviceSurcharge", "Phụ phí dịch vụ"],
  ["specialSurcharge", "Phụ phí hàng đặc biệt"],
];

// Tach ro tung khoan cau thanh phi (US-17).
export default function FeeBreakdown({ fee, testID }) {
  return (
    <View style={styles.wrap} testID={testID}>
      {LINES.map(([key, label]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{formatVnd(fee[key])}</Text>
        </View>
      ))}
      <View style={[styles.row, styles.total]}>
        <Text style={styles.totalLabel}>Tổng phí vận chuyển</Text>
        <Text style={styles.totalValue}>{formatVnd(fee.total)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 13, color: colors.text },
  total: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 6, marginTop: 2 },
  totalLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: 14, fontWeight: "700", color: colors.text },
});
