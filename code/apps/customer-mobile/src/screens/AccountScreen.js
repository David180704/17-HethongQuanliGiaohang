import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { useAuth } from "../auth/AuthContext";
import { useCachedQuery } from "../lib/useCachedQuery";
import { errorMessage } from "../lib/apiClient";
import { CUSTOMER_TYPE_LABELS, avatarLetter } from "../lib/format";
import { colors } from "../theme";

export default function AccountScreen({ onLogin, onRegister, onLogout, onCreateOrder }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Screen title="Tài khoản" bottomInset={false}>
        <Card title="Bạn chưa đăng nhập">
          <Text style={styles.muted}>
            Xem bảng giá và vùng phục vụ không cần tài khoản. Đăng nhập để tạo đơn, thanh toán và theo dõi đơn hàng.
          </Text>
          <Button testID="account-login" title="Đăng nhập" onPress={onLogin} />
          <Button testID="account-register" title="Đăng ký tài khoản" variant="secondary" onPress={onRegister} />
        </Card>
      </Screen>
    );
  }
  return <Profile user={user} onLogout={onLogout} onCreateOrder={onCreateOrder} />;
}

function Profile({ user, onLogout, onCreateOrder }) {
  // /auth/me qua cache 30 giay; dang nhap/dang xuat da clear() cache.
  const { data, error } = useCachedQuery("/auth/me");
  const profile = data || user;

  return (
    <Screen title="Tài khoản của tôi" bottomInset={false}>
      <View style={styles.profileHead}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter(profile.fullName)}</Text>
        </View>
        <View style={styles.profileText}>
          <Text role="heading" style={styles.name}>
            {profile.fullName}
          </Text>
          <Text style={styles.muted}>{profile.email}</Text>
        </View>
      </View>

      <Banner>{error ? errorMessage(error, "Không tải được thông tin tài khoản") : ""}</Banner>

      <Card title="Thông tin">
        <Row label="Họ tên" value={profile.fullName} />
        <Row label="Email" value={profile.email} />
        <Row label="Số điện thoại" value={profile.phone} />
        <Row label="Loại khách hàng" value={CUSTOMER_TYPE_LABELS[profile.customerType] || "—"} />
        {profile.shopName ? <Row label="Tên shop" value={profile.shopName} /> : null}
      </Card>

      <Card title="Đơn hàng của tôi">
        <Text style={styles.muted}>Danh sách và chi tiết đơn hàng — sắp có (#20 · Sprint 4).</Text>
        <Button title="Tạo đơn mới" variant="secondary" onPress={onCreateOrder} />
      </Card>

      <Button testID="account-logout" title="Đăng xuất" variant="danger" onPress={onLogout} />
    </Screen>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  profileHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  profileText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: colors.bg,
  },
  rowLabel: { fontSize: 14, color: colors.muted },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.text, flexShrink: 1, textAlign: "right" },
});
