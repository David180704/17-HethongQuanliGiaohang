import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { colors, radius } from "../../theme";

const STATUS_LABEL = {
  AT_DEST_HUB: "Mới tới kho",
  RESCHEDULED: "Chờ giao lại",
  DELIVERY_ASSIGNED: "Chờ nhận kiện",
  OUT_FOR_DELIVERY: "Đang giao",
  RETURNING: "Hoàn hàng",
};

// US-35, US-37 (de 02): bang phan cong giao / hoan hom nay cua hub. Don toi kho dich duoc phan cong tu dong;
// o day kho xem hang cho (khong co ca, tuyen da day), tai giao theo ca, chay lai tu dong, dieu chinh tay (bat
// buoc ly do) va don hoan da tra cho shop dang cho shop xac nhan. Kem chinh sach giao lai (US-36).
export default function AssignDeliveryScreen({ accent, onBack }) {
  const [board, setBoard] = useState(null);
  const [form, setForm] = useState(null); // { orderId, routeId, currentId, shipperId, reason }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard((await apiClient.get("/deliveries/board")).data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được bảng phân công giao"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setError("");
    setNotice("");
    setWarning("");
  };

  async function runAuto() {
    reset();
    setBusy(true);
    try {
      const { assigned, unassigned } = (await apiClient.post("/deliveries/auto")).data.data;
      setNotice(`Phân công tự động: ${assigned} đơn đã có người, ${unassigned} đơn vẫn chờ`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setError("");
    setBusy(true);
    try {
      const data = (await apiClient.post("/deliveries/assign", { orderId: form.orderId, shipperId: form.shipperId, reason: form.reason })).data.data;
      setNotice(`Đã giao ${data.trackingCode} cho ${data.shipper.fullName}`);
      setWarning(
        data.overCapacity
          ? `${data.shipper.fullName} vượt năng lực giao của ca (${data.load}/${data.capacity} đơn)`
          : data.shift
            ? ""
            : `${data.shipper.fullName} không có ca còn mở hôm nay — phân công ngoài ca`,
      );
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const shippersOf = (routeId) => board?.shippersByRoute.find((r) => r._id === routeId)?.shippers || [];
  const openForm = (order) => {
    reset();
    setForm({ orderId: order._id, routeId: order.route?._id, currentId: order.assignedTo?._id, shipperId: "", reason: "" });
  };

  const manualForm = (order) =>
    form?.orderId === order._id ? (
      <View style={styles.editor} testID="delivery-assign-form">
        <ChipSelect
          testID="delivery-assign-shipper"
          label="Người giao hàng của tuyến"
          required
          options={shippersOf(form.routeId)
            .filter((s) => s._id !== form.currentId)
            .map((s) => ({ value: s._id, label: s.fullName }))}
          value={form.shipperId}
          onChange={(shipperId) => setForm({ ...form, shipperId })}
        />
        <TextField
          testID="delivery-assign-reason"
          label="Lý do điều chỉnh"
          required
          placeholder="Nghỉ, đổi ca, quá tải, đơn ưu tiên..."
          value={form.reason}
          onChangeText={(reason) => setForm({ ...form, reason })}
        />
        <View style={styles.row}>
          <Button testID="delivery-assign-save" title="Giao cho người này" loading={busy} onPress={save} style={styles.grow} />
          <Button title="Hủy" variant="secondary" onPress={() => setForm(null)} style={styles.grow} />
        </View>
      </View>
    ) : null;

  const card = (order, prefix, extra) => (
    <View key={order._id} style={styles.card} testID={`${prefix}-${order.trackingCode}`}>
      <View style={styles.head}>
        <Text style={styles.title}>
          {order.trackingCode}
          {order.express ? <Text style={styles.express}>  Gửi nhanh · ưu tiên</Text> : null}
        </Text>
        <Text style={styles.badge}>
          {order.kind === "RETURN" ? "Hoàn" : "Giao"} · {order.route?.code || "?"}
        </Text>
      </View>
      <Text style={styles.muted}>
        {order.customerName} → {order.to} · {STATUS_LABEL[order.status] || order.status}
        {order.attempts ? ` · đã giao hụt ${order.attempts} lần` : ""}
      </Text>
      {extra}
      {form?.orderId === order._id || order.status === "OUT_FOR_DELIVERY" ? null : (
        <Button
          title={order.assignedTo ? "Đổi người" : "Phân công tay"}
          size="sm"
          variant="secondary"
          accessibilityLabel={`${order.assignedTo ? "Đổi người" : "Phân công tay"} ${order.trackingCode}`}
          onPress={() => openForm(order)}
        />
      )}
      {manualForm(order)}
    </View>
  );

  return (
    <Screen title="Phân công giao" subtitle="Giao và hoàn hàng tự động theo ca, điều chỉnh có lý do" accent={accent} onBack={onBack}>
      <Banner testID="delivery-assign-error">{error}</Banner>
      <Banner tone="success" testID="delivery-assign-notice">
        {notice}
      </Banner>
      <Banner tone="warning">{warning}</Banner>
      {board === null ? <Text style={styles.muted}>Đang tải...</Text> : null}
      {board ? (
        <>
          <Text style={styles.muted} testID="delivery-policy">
            Chính sách: giao tối đa {board.policy.maxDeliveryAttempts} lần; người nhận từ chối hoặc quá số lần thì hoàn về người gửi.
          </Text>
          <View style={styles.head}>
            <Text role="heading" style={styles.section}>
              Hàng chờ ({board.queue.length})
            </Text>
            <Button testID="delivery-assign-run" title="Phân công lại tự động" size="sm" loading={busy} onPress={runAuto} />
          </View>
          {board.queue.length === 0 ? <Text style={styles.muted}>Không có đơn chờ phân công.</Text> : null}
          {board.queue.map((order) =>
            card(order, "delivery-queue", order.unassignedReason ? <Text style={styles.reason}>{order.unassignedReason}</Text> : null),
          )}

          <Text role="heading" style={styles.section}>
            Tải giao theo ca hôm nay
          </Text>
          {board.shifts.length === 0 ? <Text style={styles.muted}>Hôm nay chưa có ca nào — vào "Ca làm việc" để xếp ca.</Text> : null}
          {board.shifts.map((shift) => (
            <View key={shift._id} style={styles.card} testID={`delivery-shift-${shift.code}`}>
              <View style={styles.head}>
                <Text style={styles.title}>
                  {shift.name} · {shift.startTime}–{shift.endTime}
                </Text>
                <Text style={styles.badge}>{shift.route?.code}</Text>
              </View>
              {shift.shippers.map((s) => (
                <Text key={s._id} style={[styles.load, s.capacity && s.used >= s.capacity ? styles.full : null]}>
                  {s.fullName}: {s.used}/{s.capacity ?? "?"} đơn · {s.pending} chưa xong
                </Text>
              ))}
            </View>
          ))}

          <Text role="heading" style={styles.section}>
            Đã phân công ({board.assigned.length})
          </Text>
          {board.assigned.map((order) => card(order, "delivery-assigned", <Text style={styles.muted}>Người giao: {order.assignedTo?.fullName || "?"}</Text>))}

          {board.awaitingShop.length ? (
            <Text role="heading" style={styles.section}>
              Đã trả hàng hoàn, chờ người gửi xác nhận ({board.awaitingShop.length})
            </Text>
          ) : null}
          {board.awaitingShop.map((order) => (
            <View key={order._id} style={styles.card} testID={`delivery-awaiting-${order.trackingCode}`}>
              <Text style={styles.title}>{order.trackingCode}</Text>
              <Text style={styles.muted}>
                {order.customerName} · {order.returnReason}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  editor: { gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 6 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  badge: { fontSize: 12, fontWeight: "700", color: colors.primary },
  muted: { fontSize: 13, color: colors.muted },
  reason: { fontSize: 13, color: "#92400E" },
  express: { fontSize: 12, fontWeight: "800", color: "#B91C1C" },
  load: { fontSize: 14, color: colors.text },
  full: { color: colors.danger, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
