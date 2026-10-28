import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

export const TABS = [
  { key: "home", label: "Trang chủ", glyph: "⌂" },
  { key: "pricing", label: "Bảng giá", glyph: "₫" },
  { key: "coverage", label: "Vùng phục vụ" },
  { key: "account", label: "Tài khoản" },
];

// Bieu tuong ve bang View cho 2 tab khong co ky tu hop: ky tu ◎ ◉ lay tu font du phong
// cua Android hien rat nho so voi ⌂ ₫ (thay khi chup man hinh tren may ao).
function TabIcon({ tab, color }) {
  if (tab.key === "coverage") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.ring, { borderColor: color }]}>
          <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
      </View>
    );
  }
  if (tab.key === "account") {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.head, { borderColor: color }]} />
        <View style={[styles.shoulders, { borderColor: color }]} />
      </View>
    );
  }
  return <Text style={[styles.glyph, { color }]}>{tab.glyph}</Text>;
}

// Thanh tab duoi day, kieu app thuong mai dien tu. Moi tab co testID "tab-<key>" cho Maestro.
export default function TabBar({ active, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]} role="tablist">
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            testID={`tab-${tab.key}`}
            role="tab"
            aria-selected={selected}
            aria-label={tab.label}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <TabIcon tab={tab} color={selected ? colors.primary : colors.faint} />
            <Text style={[styles.label, selected && styles.activeText]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 },
  glyph: { fontSize: 18, lineHeight: 22 },
  iconBox: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  ring: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  head: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, marginBottom: 1 },
  shoulders: { width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderBottomWidth: 0 },
  label: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  activeText: { color: colors.primary },
});
