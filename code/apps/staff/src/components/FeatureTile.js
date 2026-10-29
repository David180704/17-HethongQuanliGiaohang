import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Badge from "./Badge";
import { tileInitials } from "../lib/format";
import { colors, radius } from "../theme";

const GAP = 12;

// Luoi o chuc nang tu chia cot theo be rong thuc te: dien thoai 2 cot, may tinh 4 cot.
export function TileGrid({ items, renderTile, minTileWidth = 160 }) {
  const [width, setWidth] = useState(0);
  const columns = Math.max(2, Math.min(4, Math.floor((width + GAP) / (minTileWidth + GAP))));
  const tileWidth = width > 0 ? (width - GAP * (columns - 1)) / columns : 0;

  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? items.map((item) => renderTile(item, tileWidth)) : null}
    </View>
  );
}

// upcoming: "#13 · Sprint 3" -> o bi mo, khong bam duoc, ghi ro hang muc nao se lam.
// short: ky hieu tu dat khi 2 o trung chu cai dau (vd "Đơn cần lấy"/"Đơn cần giao").
export default function FeatureTile({ title, short, description, meta, upcoming, accent = colors.primary, onPress, width }) {
  const disabled = !onPress;
  return (
    <Pressable
      role="button"
      aria-label={title}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { width }, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={[styles.icon, { backgroundColor: disabled ? colors.border : accent }]}>
        <Text style={[styles.iconText, disabled && { color: colors.muted }]}>{short || tileInitials(title)}</Text>
      </View>
      <Text style={[styles.title, disabled && { color: colors.muted }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {description}
      </Text>
      {meta ? <Text style={[styles.meta, { color: accent }]}>{meta}</Text> : null}
      {upcoming ? <Badge label={`Sắp có · ${upcoming}`} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    minHeight: 150,
  },
  pressed: { backgroundColor: colors.bg },
  disabled: { backgroundColor: "#F8FAFC" },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  iconText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  description: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  meta: { fontSize: 13, fontWeight: "600" },
});
