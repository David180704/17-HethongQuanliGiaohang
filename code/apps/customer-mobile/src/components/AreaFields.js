import { Pressable, StyleSheet, Text, View } from "react-native";
import TextField from "./TextField";
import { suggest, useAddressCheck } from "../lib/adminUnits";
import { colors, radius } from "../theme";

// Tinh/thanh + xa/phuong cho dien thoai (dia gioi tu 01/07/2025, khong con quan/huyen): go vai chu ->
// cham goi y. Go tay van duoc (khong dau cung duoc) nhung phai khop danh muc, sai thi bao loi ngay.
export default function AreaFields({ idPrefix, value, onChange }) {
  const check = useAddressCheck(value.province, value.ward);
  // Goi y cho toi khi o nhap dung ten chuan (go "ben thanh" da khop van hien "Phường Bến Thành" de cham)
  const provinceHints = check.province?.name === value.province ? [] : suggest(check.provinces.map((p) => p.name), value.province);
  const wardHints = check.province && check.ward !== value.ward ? suggest(check.wards.map((w) => w.name), value.ward) : [];

  const chips = (items, onPick, key) =>
    items.length ? (
      <View style={styles.chips}>
        {items.map((name) => (
          <Pressable
            key={name}
            testID={`${idPrefix}-${key}-${name}`}
            role="button"
            aria-label={`Chọn ${name}`}
            onPress={() => onPick(name)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>{name}</Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <>
      <TextField
        testID={`${idPrefix}-province`}
        label="Tỉnh/Thành phố"
        value={value.province}
        onChangeText={(text) => onChange({ province: text })}
        onBlur={() => check.province && check.province.name !== value.province && onChange({ province: check.province.name })}
        error={check.provinceError}
        help="Gõ vài chữ rồi chọn trong gợi ý"
        autoCorrect={false}
      />
      {chips(provinceHints, (name) => onChange({ province: name }), "province")}
      <TextField
        testID={`${idPrefix}-ward`}
        label="Xã/Phường"
        value={value.ward}
        onChangeText={(text) => onChange({ ward: text })}
        onBlur={() => check.ward && check.ward !== value.ward && onChange({ ward: check.ward })}
        error={check.wardError}
        help={check.province ? `${check.wards.length || "…"} xã/phường của ${check.province.name} — không còn quận/huyện` : "Chọn tỉnh/thành trước"}
        autoCorrect={false}
      />
      {chips(wardHints, (name) => onChange({ ward: name }), "suggest")}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipPressed: { backgroundColor: colors.primaryBorder },
  chipText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
});
