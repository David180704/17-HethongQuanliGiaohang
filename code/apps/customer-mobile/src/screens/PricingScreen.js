import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Banner from "../components/Banner";
import UpdatedAt from "../components/UpdatedAt";
import { useCachedQuery } from "../lib/useCachedQuery";
import { ZONES, formatTier, formatVnd, formatSurcharge, tierAllowsExtraSteps } from "../lib/format";
import { colors, radius } from "../theme";

// Gia hien thi = cuoc co ban x (1 + he so phu phi dich vu). STANDARD va EXPRESS dung chung
// bac khoi luong (CLAUDE.md muc 5) - chenh lech nam o phu phi dich vu. Giong Web Khach hang.
export default function PricingScreen() {
  const [serviceCode, setServiceCode] = useState("STANDARD");
  const { data, loading, error: loadError, updatedAt, refresh } = useCachedQuery("/public/price-tables");
  const tables = data || [];

  const serviceTypes = [];
  for (const table of tables) {
    const type = table.serviceTypeId;
    if (type && !serviceTypes.some((t) => t.code === type.code)) serviceTypes.push(type);
  }
  serviceTypes.sort((a, b) => a.surchargeRate - b.surchargeRate);
  const selectedType = serviceTypes.find((t) => t.code === serviceCode) || serviceTypes[0];
  const rate = selectedType?.surchargeRate || 0;

  return (
    <Screen title="Bảng giá vận chuyển" subtitle="Theo vùng gửi – nhận và khối lượng" bottomInset={false}>
      <Text style={styles.intro}>
        Khối lượng tính cước là số lớn hơn giữa khối lượng thật và khối lượng quy đổi (dài × rộng × cao ÷ 5000).
      </Text>
      <UpdatedAt at={updatedAt} onRefresh={refresh} />
      <Banner>{loadError ? "Không tải được bảng giá. Vui lòng thử lại sau." : ""}</Banner>
      {loading ? <Text style={styles.muted}>Đang tải bảng giá...</Text> : null}

      {selectedType ? (
        <>
          <View style={styles.segment} role="radiogroup" aria-label="Loại dịch vụ">
            {serviceTypes.map((type) => {
              const active = type.code === selectedType.code;
              return (
                <Pressable
                  key={type.code}
                  testID={`service-${type.code}`}
                  role="radio"
                  aria-checked={active}
                  aria-label={type.name}
                  onPress={() => setServiceCode(type.code)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{type.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.muted}>{formatSurcharge(rate)} — giá dưới đây đã gồm phụ phí này.</Text>

          {ZONES.map((zone) => {
            const table = tables.find((t) => t.zone === zone.code && t.serviceTypeId?.code === selectedType.code);
            return (
              <Card key={zone.code} title={zone.label} right={<Text style={styles.hint}>{zone.hint}</Text>}>
                {table ? (
                  table.weightTiers.map((tier) => (
                    <View key={tier.fromGram} style={styles.tier}>
                      <Text style={styles.tierLabel}>{formatTier(tier)}</Text>
                      <View style={styles.tierPrice}>
                        <Text style={styles.price}>{formatVnd(tier.basePrice * (1 + rate))}</Text>
                        {tierAllowsExtraSteps(tier) ? (
                          <Text style={styles.extra}>+{formatVnd(tier.pricePer500g)} mỗi 500 g vượt</Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.muted}>Chưa có bảng giá</Text>
                )}
              </Card>
            );
          })}

          <Text style={styles.note}>
            Hàng dễ vỡ, hàng giá trị cao có phụ phí đặc biệt. Phí chính xác hiển thị khi tạo đơn và được khóa lại khi đơn
            được xác nhận.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  muted: { fontSize: 14, color: colors.muted },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  segmentTextActive: { color: "#FFFFFF" },
  hint: { fontSize: 12, color: colors.muted, flexShrink: 1, textAlign: "right" },
  tier: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: colors.bg,
  },
  tierLabel: { fontSize: 14, color: colors.muted, flexShrink: 1 },
  tierPrice: { alignItems: "flex-end" },
  price: { fontSize: 15, fontWeight: "700", color: colors.text },
  extra: { fontSize: 12, color: colors.muted },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19 },
});
