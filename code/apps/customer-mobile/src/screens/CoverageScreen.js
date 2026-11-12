import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Banner from "../components/Banner";
import TextField from "../components/TextField";
import UpdatedAt from "../components/UpdatedAt";
import { useCachedQuery } from "../lib/useCachedQuery";
import { plainText } from "../lib/orderForm";
import { colors } from "../theme";

// Vung phuc vu theo dia gioi 2 cap (tu 01/07/2025): chi tai 34 tinh/thanh; cham tinh nao moi tai
// xa/phuong cua tinh do. Go ten xa/phuong thi goi API tim kiem (toi da 50 ket qua).
export default function CoverageScreen() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, loading, error, updatedAt, refresh } = useCachedQuery("/public/provinces");
  const served = (data || []).filter((p) => p.servedCount > 0);
  const totalWards = served.reduce((sum, p) => sum + p.servedCount, 0);
  const typed = plainText(query);
  const shown = typed ? served.filter((p) => plainText(p.name).includes(typed) || plainText(p.fullName).includes(typed)) : served;

  return (
    <Screen title="Vùng phục vụ" subtitle="34 tỉnh/thành · xã/phường (địa giới 2025)" bottomInset={false}>
      <Text style={styles.intro}>Không còn quận/huyện. Chạm tỉnh/thành để xem xã/phường đang phục vụ.</Text>
      <TextField
        testID="coverage-search"
        label="Tìm vùng phục vụ"
        placeholder="Tỉnh hoặc xã/phường, vd: ba dinh"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        help="Gõ có dấu hoặc không dấu đều được."
      />
      <Banner>{error ? "Không tải được vùng phục vụ. Vui lòng thử lại sau." : ""}</Banner>
      {!loading && !error ? (
        <Text testID="coverage-status" role="status" style={styles.status}>
          {`${totalWards} xã/phường tại ${served.length} tỉnh/thành`}
        </Text>
      ) : null}
      <UpdatedAt at={updatedAt} onRefresh={refresh} />

      {query ? <WardSearch query={query} /> : null}

      {shown.map((province) => (
        <Card key={province.name} testID={`coverage-${province.name}`}>
          <Pressable
            role="button"
            aria-expanded={open === province.name}
            aria-label={`${province.name}, ${province.servedCount} xã/phường`}
            onPress={() => setOpen(open === province.name ? "" : province.name)}
            style={styles.head}
          >
            <Text style={styles.province}>{province.name}</Text>
            <Text style={styles.count}>
              {province.servedCount}/{province.wardCount} {open === province.name ? "▲" : "▼"}
            </Text>
          </Pressable>
          {open === province.name ? <ProvinceWards province={province.name} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

// Chi goi API khi tinh duoc mo
function ProvinceWards({ province }) {
  const { data, loading } = useCachedQuery("/public/provinces/wards", { province });
  if (loading) return <Text style={styles.intro}>Đang tải...</Text>;
  return (
    <View style={styles.chips}>
      {(data?.wards || [])
        .filter((w) => w.served)
        .map((w) => (
          <Text key={w.name} style={styles.chip}>
            {w.name}
          </Text>
        ))}
    </View>
  );
}

function WardSearch({ query }) {
  const { data } = useCachedQuery("/public/service-areas", { search: query });
  const found = data || [];
  if (!data) return null;
  return (
    <Card title={found.length ? `Xã/phường khớp “${query}”` : `Chưa phục vụ xã/phường nào khớp “${query}”`} testID="coverage-found">
      <View style={styles.chips}>
        {found.map((a) => (
          <Text key={`${a.province}|${a.ward}`} style={styles.chip}>
            {a.ward}, {a.province}
          </Text>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  status: { fontSize: 14, color: colors.text, fontWeight: "600" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  province: { fontSize: 16, fontWeight: "700", color: colors.text },
  count: { fontSize: 13, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
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
