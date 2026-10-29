import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Banner from "../components/Banner";
import TextField from "../components/TextField";
import UpdatedAt from "../components/UpdatedAt";
import { useCachedQuery } from "../lib/useCachedQuery";
import { REGION_LABELS } from "../lib/format";
import { colors } from "../theme";

export default function CoverageScreen() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  // Doi 300ms sau phim go cuoi moi tim (khong goi API moi lan go mot phim).
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Cung tu khoa trong 30 giay -> lay tu cache. Go khong dau van tim ra ("hoan kiem").
  const { data, loading, error, updatedAt, refresh } = useCachedQuery(
    "/public/service-areas",
    query ? { search: query } : {},
  );
  const areas = data || [];

  const byProvince = new Map();
  for (const area of areas) {
    if (!byProvince.has(area.province)) byProvince.set(area.province, { region: area.region, districts: [] });
    byProvince.get(area.province).districts.push(area.district);
  }

  let status = "";
  if (!loading && !error) {
    status = areas.length > 0 ? `${areas.length} quận/huyện tại ${byProvince.size} tỉnh/thành` : `Chưa phục vụ khu vực "${query}"`;
  }

  return (
    <Screen title="Vùng phục vụ" subtitle="Quận/huyện nhận gửi và giao hàng" bottomInset={false}>
      <Text style={styles.intro}>Chỉ nhận đơn khi cả nơi gửi và nơi nhận đều thuộc các quận/huyện dưới đây.</Text>
      <TextField
        testID="coverage-search"
        label="Tìm vùng phục vụ"
        placeholder="Tỉnh hoặc quận/huyện, vd: hoan kiem"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        help="Gõ có dấu hoặc không dấu đều được."
      />
      <Banner>{error ? "Không tải được vùng phục vụ. Vui lòng thử lại sau." : ""}</Banner>
      {status ? (
        <Text testID="coverage-status" role="status" style={styles.status}>
          {status}
        </Text>
      ) : null}
      <UpdatedAt at={updatedAt} onRefresh={refresh} />

      {[...byProvince.entries()].map(([province, info]) => (
        <Card key={province} title={province} right={<Text style={styles.region}>{REGION_LABELS[info.region] || info.region}</Text>}>
          <View style={styles.chips}>
            {info.districts.map((district) => (
              <Text key={district} style={styles.chip}>
                {district}
              </Text>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  status: { fontSize: 14, color: colors.text, fontWeight: "600" },
  region: {
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    fontSize: 14,
    color: colors.primaryPressed,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
});
