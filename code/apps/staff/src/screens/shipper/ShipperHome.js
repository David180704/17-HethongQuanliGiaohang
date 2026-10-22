import { StyleSheet, Text, View } from "react-native";
import RoleHome from "../RoleHome";
import { radius } from "../../theme";

// Ma hang muc va Sprint lay tu sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
const SHIPPER_TILES = [
  { key: "pickups", title: "Đơn cần lấy", short: "LH", description: "Danh sách đơn lấy trong ca", upcoming: "#27 · Sprint 4" },
  { key: "deliveries", title: "Đơn cần giao", short: "GH", description: "Danh sách đơn giao trong ca", upcoming: "#31 · Sprint 5" },
  { key: "cod", title: "Thu COD", description: "Ghi nhận tiền thu hộ khi giao", upcoming: "#33 · Sprint 5" },
  { key: "checkin", title: "Check-in GPS", description: "Tự động khi đi qua điểm", upcoming: "#30 · Sprint 5" },
];

// The "ca hom nay" kieu app tai xe (Grab Driver/Ahamove): so don can lay / can
// giao. Chua co module ca truc va phan cong nen hien 0 kem ghi chu.
function ShiftCard({ color }) {
  return (
    <View style={[styles.shift, { backgroundColor: color }]}>
      <Text style={styles.shiftLabel}>Ca hôm nay</Text>
      <Text style={styles.shiftTitle}>Chưa có ca trực</Text>
      <View style={styles.counters}>
        <View style={styles.counter}>
          <Text style={styles.counterValue}>0</Text>
          <Text style={styles.counterLabel}>Cần lấy</Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterValue}>0</Text>
          <Text style={styles.counterLabel}>Cần giao</Text>
        </View>
      </View>
      <Text style={styles.shiftNote}>Ca trực (#23) và phân công (#25) có ở Sprint 4</Text>
    </View>
  );
}

export default function ShipperHome({ user, theme, onLogout }) {
  const routes = Array.isArray(user.routeIds) ? user.routeIds.filter(Boolean) : [];
  const routeText = routes.length ? routes.map((r) => `${r.code} — ${r.name}`).join(", ") : "Chưa được gán tuyến";

  return (
    <RoleHome
      user={user}
      theme={theme}
      onLogout={onLogout}
      profileLines={[["Tuyến", routeText]]}
      hero={<ShiftCard color={theme.color} />}
      sections={[{ title: "Giao nhận", tiles: SHIPPER_TILES }]}
    />
  );
}

const styles = StyleSheet.create({
  shift: { borderRadius: radius.lg, padding: 18, gap: 6 },
  shiftLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  shiftTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  counters: { flexDirection: "row", gap: 12, marginTop: 8 },
  counter: { flex: 1, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radius.md, padding: 12 },
  counterValue: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  counterLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  shiftNote: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 6 },
});
