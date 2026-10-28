import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import Button from "../components/Button";
import Card from "../components/Card";
import Banner from "../components/Banner";
import UpdatedAt from "../components/UpdatedAt";
import { useAuth } from "../auth/AuthContext";
import { useCachedQuery } from "../lib/useCachedQuery";
import { formatSurcharge } from "../lib/format";
import { colors, radius } from "../theme";

const STEPS = [
  { title: "Tạo đơn", text: "Nhập người nhận, hàng hóa, chọn dịch vụ. Phí tính ngay theo bảng giá." },
  { title: "Lấy hàng", text: "Hệ thống tự phân công tài xế đúng tuyến đến lấy tận nơi." },
  { title: "Vận chuyển", text: "Theo dõi từng chặng qua mã vận đơn EXP." },
  { title: "Giao & thu hộ", text: "Giao tận tay, thu COD và đối soát định kỳ cho shop." },
];

// Trang chu cong khai: khach vang lai xem duoc het, khong can dang nhap (giong Web Khach hang).
export default function HomeScreen({ onCreateOrder, onGoTab, onLogin }) {
  const { user } = useAuth();
  const typesQuery = useCachedQuery("/public/service-types");
  const areasQuery = useCachedQuery("/public/service-areas");
  const serviceTypes = typesQuery.data || [];
  const areas = areasQuery.data || [];
  const provinceCount = new Set(areas.map((a) => a.province)).size;
  const error = typesQuery.error || areasQuery.error ? "Không tải được dữ liệu từ máy chủ. Vui lòng thử lại sau." : "";

  const brand = (
    <View style={styles.brandRow}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>E</Text>
      </View>
      <Text role="heading" style={styles.brandText}>
        EDMS Express
      </Text>
    </View>
  );
  const headerRight = user ? (
    <Pressable role="button" aria-label="Tài khoản của tôi" onPress={() => onGoTab("account")} hitSlop={8}>
      <Text style={styles.headerLink} numberOfLines={1}>
        {user.fullName}
      </Text>
    </Pressable>
  ) : (
    <Pressable testID="home-login" role="button" aria-label="Đăng nhập" onPress={onLogin} hitSlop={8}>
      <Text style={styles.headerLink}>Đăng nhập</Text>
    </Pressable>
  );

  return (
    <Screen header={brand} right={headerRight} bottomInset={false}>
      <View style={styles.hero}>
        <Text role="heading" style={styles.heroTitle}>
          Gửi hàng toàn quốc, theo dõi từng chặng
        </Text>
        <Text style={styles.heroText}>
          Xem giá và vùng phục vụ không cần đăng nhập. Chỉ khi tạo đơn và thanh toán bạn mới cần tài khoản.
        </Text>
        <View style={styles.heroActions}>
          <Button testID="home-create-order" title="Tạo đơn ngay" variant="light" onPress={onCreateOrder} />
          <Button title="Xem bảng giá" variant="outlineLight" onPress={() => onGoTab("pricing")} />
        </View>
      </View>

      <Card title="Tra cứu vận đơn">
        <Text style={styles.muted}>Nhập mã vận đơn dạng EXP + 10 chữ số.</Text>
        <View style={styles.trackRow}>
          <TextInput
            editable={false}
            aria-label="Mã vận đơn"
            placeholder="EXP0000000001"
            placeholderTextColor={colors.faint}
            style={styles.trackInput}
          />
          <View style={styles.trackButton}>
            <Text style={styles.trackButtonText}>Tra cứu</Text>
          </View>
        </View>
        <Text style={styles.soon}>Sắp có · #22 · Sprint 4</Text>
      </Card>

      <Banner>{error}</Banner>

      <Text role="heading" style={styles.sectionTitle}>
        Dịch vụ
      </Text>
      {serviceTypes.map((type) => (
        <Card
          key={type.code}
          title={type.name}
          right={<Text style={styles.badge}>Dự kiến {type.estimatedDays} ngày</Text>}
        >
          <Text style={styles.muted}>{formatSurcharge(type.surchargeRate)}</Text>
          <Pressable role="link" onPress={() => onGoTab("pricing")} hitSlop={6}>
            <Text style={styles.link}>Xem giá chi tiết</Text>
          </Pressable>
        </Card>
      ))}

      <View style={styles.stats}>
        <Stat value={areas.length || "—"} label="quận/huyện đang phục vụ" />
        <Stat value={provinceCount || "—"} label="tỉnh/thành phố" />
        <Stat value="20 triệu ₫" label="thu hộ COD tối đa mỗi đơn" />
        <Stat value="3 cách" label="trả phí: shop trả, người nhận trả, trừ vào COD" />
      </View>

      <Text role="heading" style={styles.sectionTitle}>
        Gửi hàng trong 4 bước
      </Text>
      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.muted}>{step.text}</Text>
          </View>
        </View>
      ))}

      <View style={styles.cta}>
        <Text role="heading" style={styles.ctaTitle}>
          Không chắc địa chỉ có được giao?
        </Text>
        <Text style={styles.muted}>Tra cứu quận/huyện trong vùng phục vụ trước khi gửi.</Text>
        <Button title="Kiểm tra vùng phục vụ" onPress={() => onGoTab("coverage")} />
      </View>

      <UpdatedAt
        at={typesQuery.updatedAt}
        onRefresh={() => {
          typesQuery.refresh();
          areasQuery.refresh();
        }}
      />
    </Screen>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 18, fontWeight: "800", color: colors.primary },
  brandText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  headerLink: { color: "#FFFFFF", fontWeight: "700", fontSize: 14, maxWidth: 150 },
  hero: { backgroundColor: colors.brand, borderRadius: radius.xl, padding: 20, gap: 12 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontWeight: "800" },
  heroText: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 20 },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  trackRow: { flexDirection: "row", gap: 8 },
  trackInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
    color: colors.text,
  },
  trackButton: { borderRadius: radius.md, backgroundColor: colors.border, paddingHorizontal: 14, justifyContent: "center" },
  trackButtonText: { color: colors.muted, fontWeight: "700" },
  soon: {
    alignSelf: "flex-start",
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 4 },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  link: { fontSize: 14, fontWeight: "700", color: colors.primary },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.primary },
  statLabel: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  step: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { color: "#FFFFFF", fontWeight: "800" },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  cta: { backgroundColor: colors.primarySoft, borderRadius: radius.xl, padding: 18, gap: 10 },
  ctaTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
});
