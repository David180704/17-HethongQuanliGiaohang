import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatVnd } from "../../lib/format";
import { colors, radius } from "../../theme";

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const ORDER_TILES = [
  ["created", "Đơn được tạo"],
  ["pickedUp", "Đã lấy hàng"],
  ["inTransit", "Đang vận chuyển (hiện tại)"],
  ["waitingDelivery", "Đang chờ giao (hiện tại)"],
  ["delivered", "Giao thành công"],
  ["deliveryFailed", "Giao thất bại"],
  ["returned", "Hoàn trả"],
];

// US-39 (de 02): thong ke van hanh theo khoang thoi gian - quan tri vien toan he thong, nhan vien kho theo kho
// minh. So lieu tinh bang aggregation pipeline o API; man hinh chi hien thi (thanh ngang ty le theo so lon nhat).
export default function StatsScreen({ accent, onBack }) {
  const [period, setPeriod] = useState({ from: monthStart(), to: today() });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (range) => {
    setBusy(true);
    setError("");
    try {
      setData((await apiClient.get("/stats/overview", { params: range })).data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được thống kê"));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load({ from: monthStart(), to: today() });
  }, [load]);

  const bars = (title, rows, label, value, testID) => {
    const max = Math.max(1, ...rows.map(value));
    return (
      <View style={styles.card} testID={testID}>
        <Text style={styles.section}>{title}</Text>
        {rows.length === 0 ? <Text style={styles.muted}>Chưa có số liệu.</Text> : null}
        {rows.map((row) => (
          <View key={label(row)} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {label(row)}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${(value(row) / max) * 100}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.barValue}>{value(row)}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen title="Thống kê" subtitle={data?.scope === "HUB" ? "Đơn thuộc kho của bạn" : "Toàn hệ thống"} accent={accent} onBack={onBack}>
      <View style={styles.row}>
        <TextField testID="stats-from" label="Từ ngày" value={period.from} onChangeText={(from) => setPeriod({ ...period, from })} style={styles.grow} />
        <TextField testID="stats-to" label="Đến ngày" value={period.to} onChangeText={(to) => setPeriod({ ...period, to })} style={styles.grow} />
        <Button testID="stats-load" title="Xem" loading={busy} onPress={() => load(period)} />
      </View>
      <Banner testID="stats-error">{error}</Banner>
      {data ? (
        <>
          <View style={styles.tiles}>
            {ORDER_TILES.map(([key, label]) => (
              <View key={key} style={styles.tile} testID={`stats-${key}`}>
                <Text style={styles.tileValue}>{data.orders[key]}</Text>
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.tiles}>
            <View style={styles.tile} testID="stats-revenue">
              <Text style={styles.tileValue}>{formatVnd(data.revenue.fee)}</Text>
              <Text style={styles.tileLabel}>Doanh thu phí ({data.revenue.orders} đơn khóa phí)</Text>
            </View>
            <View style={styles.tile} testID="stats-cod">
              <Text style={styles.tileValue}>{formatVnd(data.cod.collected)}</Text>
              <Text style={styles.tileLabel}>
                Thu hộ đã thu ({data.cod.orders} đơn) · tiền mặt {formatVnd(data.cod.cash)} · CK {formatVnd(data.cod.transfer)}
              </Text>
            </View>
            {data.settlements ? (
              <View style={styles.tile} testID="stats-settlements">
                <Text style={styles.tileValue}>{formatVnd(data.settlements.pending.netPayable)}</Text>
                <Text style={styles.tileLabel}>
                  Chờ chi trả ({data.settlements.pending.periods} kỳ) · đã chi {formatVnd(data.settlements.paid.netPayable)} ({data.settlements.paid.periods} kỳ)
                </Text>
              </View>
            ) : null}
          </View>
          {bars("Đơn theo shop", data.byShop, (r) => r.customerName, (r) => r.orders, "stats-by-shop")}
          {bars("Đơn theo khu vực giao (tỉnh/thành)", data.byArea, (r) => r.province, (r) => r.orders, "stats-by-area")}
          {bars("Đơn theo kho nhận", data.byHub, (r) => (r.code ? `${r.code} — ${r.name}` : r.name), (r) => r.orders, "stats-by-hub")}
          <View style={styles.card} testID="stats-shippers">
            <Text style={styles.section}>Năng suất người giao hàng</Text>
            {data.shippers.length === 0 ? <Text style={styles.muted}>Chưa có lượt lấy / giao hoàn tất trong khoảng này.</Text> : null}
            {data.shippers.map((s) => (
              <Text key={s.shipperId} style={styles.text}>
                {s.fullName}: lấy {s.pickups} · giao {s.deliveries} · hoàn {s.returns} · thất bại {s.failed}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: 150, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  tileValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  tileLabel: { fontSize: 12, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  section: { fontSize: 15, fontWeight: "800", color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 130, fontSize: 13, color: colors.text },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.bg, borderRadius: 999, overflow: "hidden" },
  bar: { height: 10, borderRadius: 999 },
  barValue: { width: 36, textAlign: "right", fontSize: 13, fontWeight: "700", color: colors.text },
});
