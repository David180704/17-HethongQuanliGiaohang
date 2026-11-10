import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { colors, radius } from "../../theme";

// US-25: bang phan cong lay hang hom nay cua hub (va buu cuc truc thuoc). Don duoc phan cong tu dong ngay khi
// duyet; o day kho xem hang cho (khong co ca / tuyen da day), tai tung nguoi theo ca, chay lai tu dong va
// dieu chinh tay (bat buoc ly do - nghi, doi ca, qua tai, don uu tien).
export default function AssignPickupScreen({ accent, onBack }) {
  const [board, setBoard] = useState(null);
  const [form, setForm] = useState(null); // { orderId, trackingCode, routeId, currentId, shipperId, reason }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/assignments/pickup");
      setBoard(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được bảng phân công"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reset() {
    setError("");
    setNotice("");
    setWarning("");
  }

  async function runAuto() {
    reset();
    setBusy(true);
    try {
      const res = await apiClient.post("/assignments/pickup/auto");
      const { assigned, unassigned } = res.data.data;
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
      const res = await apiClient.post("/assignments/pickup", {
        orderId: form.orderId,
        shipperId: form.shipperId,
        reason: form.reason,
      });
      const data = res.data.data;
      setNotice(`Đã giao ${data.trackingCode} cho ${data.shipper.fullName}`);
      setWarning(
        data.overCapacity
          ? `${data.shipper.fullName} vượt năng lực ca (${data.load}/${data.capacity} đơn)`
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
  // allowSame: don lay khong duoc (US-28) duoc giao lai cho chinh nguoi cu
  const openForm = (order, { allowSame = false } = {}) => {
    reset();
    setForm({
      orderId: order._id,
      trackingCode: order.trackingCode,
      routeId: order.route?._id,
      currentId: allowSame ? null : order.assignedTo?._id,
      shipperId: "",
      reason: "",
    });
  };

  const manualForm = (order) =>
    form?.orderId === order._id ? (
      <View style={styles.editor} testID="assign-form">
        <ChipSelect
          testID="assign-shipper"
          label="Người giao hàng của tuyến"
          required
          options={shippersOf(form.routeId)
            .filter((s) => s._id !== form.currentId)
            .map((s) => ({ value: s._id, label: s.fullName }))}
          value={form.shipperId}
          onChange={(shipperId) => setForm({ ...form, shipperId })}
        />
        <TextField
          testID="assign-reason"
          label="Lý do điều chỉnh"
          required
          placeholder="Nghỉ, đổi ca, quá tải, đơn ưu tiên..."
          value={form.reason}
          onChangeText={(reason) => setForm({ ...form, reason })}
        />
        <View style={styles.row}>
          <Button testID="assign-save" title="Giao cho người này" loading={busy} onPress={save} style={styles.grow} />
          <Button title="Hủy" variant="secondary" onPress={() => setForm(null)} style={styles.grow} />
        </View>
      </View>
    ) : null;

  return (
    <Screen title="Phân công lấy hàng" subtitle="Tự động theo ca và năng lực, điều chỉnh có lý do" accent={accent} onBack={onBack}>
      <Banner testID="assign-error">{error}</Banner>
      <Banner tone="success" testID="assign-notice">
        {notice}
      </Banner>
      <Banner tone="warning" testID="assign-warning">
        {warning}
      </Banner>
      {board === null ? <Text style={styles.muted}>Đang tải...</Text> : null}

      {board ? (
        <>
          <View style={styles.head}>
            <Text role="heading" style={styles.section}>
              Hàng chờ ({board.queue.length})
            </Text>
            <Button testID="assign-run" title="Phân công lại tự động" size="sm" loading={busy} onPress={runAuto} />
          </View>
          {board.queue.length === 0 ? (
            <Text style={styles.muted} testID="assign-queue-empty">
              Không có đơn chờ phân công.
            </Text>
          ) : null}
          {board.queue.map((order) => (
            <View key={order._id} style={styles.card} testID={`assign-queue-${order.trackingCode}`}>
              <View style={styles.head}>
                <Text style={styles.title}>{order.trackingCode}</Text>
                <Text style={styles.badge}>{order.route?.code || "?"}</Text>
              </View>
              <Text style={styles.muted}>
                {order.customerName} · {order.pickupWard}
              </Text>
              {order.unassignedReason ? <Text style={styles.reason}>{order.unassignedReason}</Text> : null}
              {form?.orderId === order._id ? null : (
                <Button
                  title="Phân công tay"
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={`Phân công tay ${order.trackingCode}`}
                  onPress={() => openForm(order)}
                />
              )}
              {manualForm(order)}
            </View>
          ))}

          {board.failed?.length ? (
            <Text role="heading" style={styles.section}>
              Lấy không được ({board.failed.length})
            </Text>
          ) : null}
          {board.failed?.map((order) => (
            <View key={order._id} style={styles.card} testID={`assign-failed-${order.trackingCode}`}>
              <View style={styles.head}>
                <Text style={styles.title}>{order.trackingCode}</Text>
                <Text style={styles.badge}>{order.route?.code || "?"}</Text>
              </View>
              <Text style={styles.muted}>
                {order.customerName} · {order.assignedTo?.fullName || "?"}
              </Text>
              {order.failNote ? <Text style={styles.reason}>{order.failNote}</Text> : null}
              {form?.orderId === order._id ? null : (
                <Button
                  title="Giao lại"
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={`Giao lại ${order.trackingCode}`}
                  onPress={() => openForm(order, { allowSame: true })}
                />
              )}
              {manualForm(order)}
            </View>
          ))}

          <Text role="heading" style={styles.section}>
            Tải theo ca hôm nay
          </Text>
          {board.shifts.length === 0 ? <Text style={styles.muted}>Hôm nay chưa có ca nào — vào "Ca làm việc" để xếp ca.</Text> : null}
          {board.shifts.map((shift) => (
            <View key={shift._id} style={styles.card} testID={`assign-shift-${shift.code}`}>
              <View style={styles.head}>
                <Text style={styles.title}>
                  {shift.name} · {shift.startTime}–{shift.endTime}
                </Text>
                <Text style={styles.badge}>{shift.route?.code}</Text>
              </View>
              {shift.shippers.length === 0 ? <Text style={styles.muted}>Chưa gán người.</Text> : null}
              {shift.shippers.map((s) => (
                <Text key={s._id} style={[styles.load, s.capacity && s.used >= s.capacity ? styles.full : null]}>
                  {s.fullName}: {s.used}/{s.capacity ?? "?"} đơn · {s.pending} chưa lấy
                </Text>
              ))}
            </View>
          ))}

          <Text role="heading" style={styles.section}>
            Đã phân công ({board.assigned.length})
          </Text>
          {board.assigned.map((order) => (
            <View key={order._id} style={styles.card} testID={`assign-done-${order.trackingCode}`}>
              <View style={styles.head}>
                <Text style={styles.title}>{order.trackingCode}</Text>
                <Text style={styles.badge}>{order.route?.code || "?"}</Text>
              </View>
              <Text style={styles.muted}>
                {order.customerName} → {order.assignedTo?.fullName || "?"}
              </Text>
              {form?.orderId === order._id ? null : (
                <Button
                  title="Đổi người"
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={`Đổi người ${order.trackingCode}`}
                  onPress={() => openForm(order)}
                />
              )}
              {manualForm(order)}
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
  load: { fontSize: 14, color: colors.text },
  full: { color: colors.danger, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
