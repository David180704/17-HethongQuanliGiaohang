import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import TextField from "./TextField";
import { useCachedQuery } from "../lib/useCachedQuery";
import { colors, radius } from "../theme";

// Dia chi Viet Nam cho dien thoai: go vai chu quan/huyen -> hien goi y trong vung
// phuc vu, cham mot cai dien luon tinh/thanh. Go tay van duoc (khong dau cung duoc),
// server khop ten chuan va bao loi neu ngoai vung phuc vu.
export default function AddressFields({ idPrefix, value, onChange, addressLabel = "Địa chỉ (số nhà, đường)" }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value.district.trim()), 300);
    return () => clearTimeout(timer);
  }, [value.district]);

  const enabled = query.length >= 2;
  const { data } = useCachedQuery("/public/service-areas", { search: query }, { enabled });
  const picked = (area) => area.district === value.district && area.province === value.province;
  const suggestions = enabled ? (data || []).filter((area) => !picked(area)).slice(0, 4) : [];

  const field = (name, label, props = {}) => (
    <TextField
      testID={`${idPrefix}-${name}`}
      label={label}
      value={value[name]}
      onChangeText={(text) => onChange({ [name]: text })}
      {...props}
    />
  );

  return (
    <>
      {field("address", addressLabel)}
      {field("district", "Quận/Huyện", { help: "Gõ vài chữ rồi chọn quận/huyện trong vùng phục vụ", autoCorrect: false })}
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
      {field("province", "Tỉnh/Thành phố")}
      {field("ward", "Phường/Xã")}
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
