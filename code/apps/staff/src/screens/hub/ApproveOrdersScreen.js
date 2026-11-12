import { useCallback, useEffect, useRef, useState } from "react";
import { formatVnd } from "../../lib/format";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { queryCache, CACHE_TTL_MS, formatTime } from "../../lib/queryCache";
import { colors, radius } from "../../theme";

const FEE_PAYER_LABELS = {
  SHOP_PREPAID: "Người gửi trả trước",
  RECIPIENT_PAID: "Người nhận trả",
  DEDUCT_FROM_COD: "Trừ vào thu hộ",
};
// Hermes tren Android co the thieu Intl vi-VN -> dung ham tu nhom hang nghin
const vnd = formatVnd;

// Duyet don moi (US-18): don CREATED cua hub minh va buu cuc truc thuoc (server loc theo
// hubId). Xac nhan -> CONFIRMED, phi khoa vao don (US-17). Hai nguoi cung bam -> nguoi
// sau nhan bao loi "da duoc xu ly" va danh sach tu lam moi.
export default function ApproveOrdersScreen({ user, accent, onBack }) {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async ({ force = false } = {}) => {
      const seq = ++requestSeq.current;
      setError("");
      try {
        const { body, fetchedAt } = await queryCache.get(
          "/orders",
          { status: "CREATED", limit: 50, search: query || undefined },
          { force },
        );
        if (seq !== requestSeq.current) return;
        setOrders(body.data);
        setTotal(body.meta.total);
        setUpdatedAt(fetchedAt);
      } catch (err) {
        if (seq === requestSeq.current) setError(errorMessage(err, "Không tải được đơn chờ duyệt"));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    load({ force: true });
    const timer = setInterval(() => load({ force: true }), CACHE_TTL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function confirm(order) {
    setBusyId(order._id);
    setNotice("");
    setError("");
    try {
      await apiClient.post(`/orders/${order._id}/confirm`);
      setNotice(`Đã xác nhận ${order.trackingCode} — phí ${vnd(order.fee.total)} đã khóa`);
    } catch (err) {
      setError(errorMessage(err, "Không xác nhận được đơn"));
    } finally {
      queryCache.invalidate("/orders");
      setBusyId(null);
      load({ force: true });
    }
  }

  const hub = user.hubId;
  return (
    <Screen title="Duyệt đơn mới" subtitle={hub ? `${hub.name} (${hub.code})` : "Nhân viên kho"} accent={accent} onBack={onBack}>
      <TextField
        testID="approve-search"
        placeholder="Tìm mã vận đơn, tên / SĐT người nhận..."
        value={searchInput}
        onChangeText={setSearchInput}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <View style={styles.toolbar}>
        <Text style={styles.count} testID="approve-count">
          {loading ? "Đang tải..." : `${total} đơn chờ xác nhận`}
        </Text>
        <Button title="Làm mới" variant="secondary" size="sm" onPress={() => load({ force: true })} />
      </View>
      {updatedAt ? <Text style={styles.faint}>Cập nhật lúc {formatTime(updatedAt)} · tự làm mới mỗi 30 giây</Text> : null}
      <Banner tone="success">{notice}</Banner>
      <Banner>{error}</Banner>

      {loading && orders.length === 0 ? <ActivityIndicator color={accent} /> : null}
      {!loading && orders.length === 0 ? (
        <Text style={styles.empty}>{query ? `Không có đơn chờ duyệt khớp "${query}"` : "Không còn đơn chờ xác nhận"}</Text>
      ) : null}

      {orders.map((order) => (
        <View key={order._id} style={styles.card} testID={`approve-${order.trackingCode}`}>
          <View style={styles.cardHead}>
            <Text style={styles.code}>{order.trackingCode}</Text>
            <Text style={styles.fee}>{vnd(order.fee.total)}</Text>
          </View>
          <Line label="Người gửi" value={`${order.customerName} · ${order.pickupWard}`} />
          <Line label="Giao đến" value={`${order.receiver.ward}, ${order.receiver.province}`} />
          <Line label="Hàng" value={`${order.item.name} · ${order.chargeableWeight.toLocaleString("vi-VN")} g · ${order.serviceName}`} />
          <Line label="Phí ship" value={FEE_PAYER_LABELS[order.cod?.feePayer] || "—"} />
          <Line label="Thu hộ" value={order.cod?.enabled ? vnd(order.cod.amount) : "Không"} />
          <Line label="Tạo lúc" value={new Date(order.createdAt).toLocaleString("vi-VN")} />
          <Button
            title="Xác nhận đơn"
            accessibilityLabel={`Xác nhận ${order.trackingCode}`}
            onPress={() => confirm(order)}
            loading={busyId === order._id}
            disabled={Boolean(busyId)}
          />
        </View>
      ))}
    </Screen>
  );
}

function Line({ label, value }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  count: { fontSize: 14, color: colors.muted },
  faint: { fontSize: 12, color: colors.faint },
  empty: { fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 16, fontWeight: "800", color: colors.text, letterSpacing: 0.5 },
  fee: { fontSize: 15, fontWeight: "700", color: colors.text },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  lineLabel: { fontSize: 13, color: colors.muted },
  lineValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: "right" },
});
