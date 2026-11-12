import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import TextField from "./TextField";
import { useCachedQuery } from "../lib/useCachedQuery";
import { colors, radius } from "../theme";

// Quan/huyen + tinh/thanh cho dien thoai: go vai chu quan/huyen -> hien goi y trong vung
// phuc vu, cham mot cai dien luon tinh/thanh. Go tay van duoc (khong dau cung duoc).
export default function AreaFields({ idPrefix, value, onChange }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value.district.trim()), 300);
    return () => clearTimeout(timer);
  }, [value.district]);

  const enabled = query.length >= 2;
  const { data } = useCachedQuery("/public/service-areas", { search: query }, { enabled });
  const picked = (area) => area.district === value.district && area.province === value.province;
  const suggestions = enabled ? (data || []).filter((area) => !picked(area)).slice(0, 4) : [];

  return (
    <>
      <TextField
        testID={`${idPrefix}-district`}
        label="Quận/Huyện"
        value={value.district}
        onChangeText={(text) => onChange({ district: text })}
        help="Gõ vài chữ rồi chọn quận/huyện trong vùng phục vụ"
        autoCorrect={false}
      />
      {suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((area) => (
            <Pressable
              key={area._id}
              testID={`${idPrefix}-suggest-${area.district}`}
              role="button"
              aria-label={`Chọn ${area.district}, ${area.province}`}
              onPress={() => onChange({ district: area.district, province: area.province })}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>
                {area.district}, {area.province}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextField
        testID={`${idPrefix}-province`}
        label="Tỉnh/Thành phố"
        value={value.province}
        onChangeText={(text) => onChange({ province: text })}
      />
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
