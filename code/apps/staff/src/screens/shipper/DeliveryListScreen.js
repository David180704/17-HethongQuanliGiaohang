import { useCallback, useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Banner from "../../components/Banner";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatVnd } from "../../lib/format";
import { formatPosition, getPosition, loadPosition } from "../../lib/location";
import { colors, radius } from "../../theme";

const STATUS_LABEL = {
  DELIVERY_ASSIGNED: "Chờ nhận kiện",
  OUT_FOR_DELIVERY: "Đang giao",
  DELIVERED: "Giao thành công",
  RESCHEDULED: "Chờ giao lại",
  RETURNING: "Hoàn về người gửi",
  RETURNED: "Đã hoàn",
};
const METHODS = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "TRANSFER", label: "Chuyển khoản" },
];

// Sprint 6 (de 02): US-31 don can giao trong ca + phieu giao QR; US-32 quet ma nhan kien, giao thanh cong (GPS)
// hoac that bai (nguyen nhan bat buoc); US-33 thu dung so tien cua nguoi nhan; US-37 tra hang hoan cho nguoi gui.
export default function DeliveryListScreen({ accent, onBack }) {
  const [shiftId, setShiftId] = useState(null);
  const [data, setData] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [action, setAction] = useState(null); // { orderId, trackingCode, kind: start|delivered|failed|handback|slip, ... }
  const [slip, setSlip] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPositionState] = useState(getPosition());

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/deliveries/mine", { params: shiftId ? { shiftId } : {} });
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được đơn cần giao"));
    }
  }, [shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPosition().then(setPositionState);
    apiClient
      .get("/deliveries/fail-reasons")
      .then((res) => setReasons(res.data.data))
      .catch(() => {});
  }, []);

  async function open(order, kind) {
    setError("");
    setNotice("");
    setPositionState(getPosition());
    setSlip(null);
    setAction({ orderId: order.orderId, trackingCode: order.trackingCode, kind, code: "", amount: "", method: "CASH", txnRef: "", reason: "", note: "" });
    if (kind === "slip") {
      try {
        setSlip((await apiClient.get(`/deliveries/${order.orderId}/slip`)).data.data);
      } catch (err) {
        setError(errorMessage(err));
      }
    }
  }

  async function submit(order) {
    setBusy(true);
    setError("");
    const { lat, lng } = getPosition();
    const id = action.orderId;
    try {
      if (action.kind === "start") {
        await apiClient.post(`/deliveries/${id}/start`, { code: action.code, lat, lng });
        setNotice(`Đã nhận kiện ${action.trackingCode}, đang đi giao`);
      } else if (action.kind === "delivered") {
        const body = { lat, lng };
        if (order.collect.total > 0) Object.assign(body, { collectedAmount: Number(action.amount), method: action.method, txnRef: action.txnRef });
        await apiClient.post(`/deliveries/${id}/delivered`, body);
        setNotice(order.collect.total > 0 ? `Giao thành công ${action.trackingCode} — đã thu ${formatVnd(order.collect.total)}` : `Giao thành công ${action.trackingCode}`);
      } else if (action.kind === "failed") {
        const res = await apiClient.post(`/deliveries/${id}/failed`, { reason: action.reason, note: action.note, lat, lng });
        const { status, attempts, maxAttempts } = res.data.data;
        setNotice(
          status === "RETURNING"
            ? `${action.trackingCode}: giao không thành công lần ${attempts} — chuyển hoàn về người gửi`
            : `${action.trackingCode}: giao không thành công lần ${attempts}/${maxAttempts} — chờ giao lại`,
        );
      } else if (action.kind === "handback") {
        await apiClient.post(`/deliveries/${id}/handed-back`, { lat, lng });
        setNotice(`Đã trả ${action.trackingCode} cho người gửi — chờ người gửi xác nhận`);
      }
      setAction(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const options = data
    ? [
        ...data.shifts.map((s) => ({ value: s._id, label: `${s.name} ${s.startTime}–${s.endTime}${s._id === data.currentShiftId ? " (hiện tại)" : ""}` })),
        { value: "all", label: "Cả ngày" },
      ]
    : [];

  const slipView = () =>
    slip ? (
      <View style={styles.slip} testID="slip">
        <Text style={styles.slipTitle}>PHIẾU GIAO HÀNG</Text>
        <Image source={{ uri: slip.qr }} style={styles.qr} accessibilityLabel={`Mã QR ${slip.trackingCode}`} testID="slip-qr" />
        <Text style={styles.slipCode}>{slip.trackingCode}</Text>
        <Text style={styles.text}>
          {slip.serviceName}
          {slip.express ? " · Gửi nhanh – ưu tiên" : ""}
        </Text>
        <Text style={styles.text} testID="slip-receiver">
          Người nhận: {slip.receiver.name} · {slip.receiver.phone}
        </Text>
        <Text style={styles.text}>Địa chỉ: {slip.receiver.address}</Text>
        <Text style={styles.text}>
          Xã/phường: {slip.receiver.ward}, {slip.receiver.province}
        </Text>
        <Text style={styles.text}>
          Hàng: {slip.item.name} · {slip.item.weightGram} g · {slip.item.size}
          {slip.item.fragile ? " · Dễ vỡ" : ""}
        </Text>
        {slip.item.note ? <Text style={styles.text}>Lưu ý: {slip.item.note}</Text> : null}
        <Text style={styles.collect} testID="slip-collect">
          Thu của người nhận: {formatVnd(slip.collect.total)}
        </Text>
        <Text style={styles.muted}>Người gửi: {slip.sender.name}</Text>
        {Platform.OS === "web" ? (
          <Button testID="slip-print" title="In phiếu" variant="secondary" size="sm" onPress={() => globalThis.print?.()} />
        ) : null}
      </View>
    ) : null;

  const form = (o) => {
    if (action?.orderId !== o.orderId || action.kind === "slip") return null;
    const titles = { start: "Nhận kiện, đi giao", delivered: "Xác nhận giao thành công", failed: "Ghi nhận giao không thành công", handback: "Xác nhận đã trả hàng" };
    return (
      <View style={styles.editor} testID="delivery-form">
        <Text style={styles.muted} testID="delivery-position">
          Vị trí (giả lập): {formatPosition(position)} · {position.label}
        </Text>
        {action.kind === "start" ? (
          <TextField
            testID="delivery-code"
            label="Quét / nhập mã vận đơn trên kiện"
            required
            autoCapitalize="characters"
            placeholder="EXP..."
            value={action.code}
            onChangeText={(code) => setAction({ ...action, code })}
          />
        ) : null}
        {action.kind === "delivered" && o.collect.total > 0 ? (
          <>
            <Text style={styles.collect}>Phải thu: {formatVnd(o.collect.total)}</Text>
            <TextField
              testID="delivery-amount"
              label="Số tiền đã thu (đ)"
              required
              keyboardType="number-pad"
              value={action.amount}
              onChangeText={(amount) => setAction({ ...action, amount })}
            />
            <ChipSelect testID="delivery-method" label="Hình thức" required options={METHODS} value={action.method} onChange={(method) => setAction({ ...action, method })} />
            {action.method === "TRANSFER" ? (
              <TextField testID="delivery-txn" label="Mã giao dịch" required value={action.txnRef} onChangeText={(txnRef) => setAction({ ...action, txnRef })} />
            ) : null}
          </>
        ) : null}
        {action.kind === "failed" ? (
          <>
            <ChipSelect
              testID="delivery-reason"
              label="Nguyên nhân"
              required
              options={reasons}
              value={action.reason}
              onChange={(reason) => setAction({ ...action, reason })}
            />
            <TextField
              testID="delivery-note"
              label={action.reason === "OTHER" ? "Ghi rõ nguyên nhân" : "Ghi chú (tuỳ chọn)"}
              required={action.reason === "OTHER"}
              value={action.note}
              onChangeText={(note) => setAction({ ...action, note })}
            />
          </>
        ) : null}
        <View style={styles.row}>
          <Button
            testID="delivery-submit"
            title={titles[action.kind]}
            variant={action.kind === "failed" ? "danger" : "primary"}
            loading={busy}
            onPress={() => submit(o)}
            style={styles.grow}
          />
          <Button title="Hủy" variant="secondary" onPress={() => setAction(null)} style={styles.grow} />
        </View>
      </View>
    );
  };

  const actions = (o) => {
    if (o.assignmentStatus !== "ASSIGNED" || action?.orderId === o.orderId) return null;
    const btn = (title, kind, variant = "primary") => (
      <Button key={kind} title={title} size="sm" variant={variant} accessibilityLabel={`${title} ${o.trackingCode}`} onPress={() => open(o, kind)} style={styles.grow} />
    );
    if (o.type === "RETURN") return o.returnHandedAt ? null : <View style={styles.row}>{btn("Đã trả hàng cho người gửi", "handback")}</View>;
    if (o.status === "DELIVERY_ASSIGNED") return <View style={styles.row}>{[btn("Phiếu giao", "slip", "secondary"), btn("Nhận kiện, đi giao", "start")]}</View>;
    if (o.status === "OUT_FOR_DELIVERY") {
      return (
        <View style={styles.row}>
          {[btn("Phiếu giao", "slip", "secondary"), btn("Giao thành công", "delivered"), btn("Không giao được", "failed", "danger")]}
        </View>
      );
    }
    return null;
  };

  return (
    <Screen title="Đơn cần giao" subtitle="Giao hàng, thu tiền, hoàn hàng trong ca" accent={accent} onBack={onBack}>
      <Banner testID="delivery-error">{error}</Banner>
      <Banner tone="success" testID="delivery-notice">
        {notice}
      </Banner>
      {data === null ? <Text style={styles.muted}>Đang tải...</Text> : null}
      {data ? (
        <>
          {data.shifts.length ? (
            <ChipSelect testID="delivery-shift" label="Ca" options={options} value={data.selectedShiftId || "all"} onChange={setShiftId} />
          ) : (
            <Text style={styles.muted}>Hôm nay bạn chưa có ca trực.</Text>
          )}
          <View style={styles.counters} testID="delivery-counts">
            <Text style={styles.count}>Cần giao: {data.counts.toDeliver}</Text>
            <Text style={styles.count}>Cần hoàn: {data.counts.toReturn}</Text>
            <Text style={styles.count}>Xong: {data.counts.done}</Text>
            <Text style={styles.count}>Không giao được: {data.counts.failed}</Text>
          </View>
          <Text style={styles.collect} testID="delivery-to-collect">
            Tiền cần thu trong ca: {formatVnd(data.counts.toCollect)}
          </Text>
          {data.orders.length === 0 ? (
            <Text style={styles.muted} testID="delivery-empty">
              Chưa có đơn cần giao trong ca này.
            </Text>
          ) : null}
          {data.orders.map((o) => (
            <View key={o.assignmentId} style={styles.card} testID={`delivery-${o.trackingCode}`}>
              <View style={styles.head}>
                <Text style={styles.title}>{o.trackingCode}</Text>
                <Text style={[styles.badge, o.assignmentStatus === "FAILED" && styles.failed]}>
                  {o.type === "RETURN" ? "Hoàn hàng" : "Giao"} · {o.assignmentStatus === "FAILED" ? "Không giao được" : STATUS_LABEL[o.status] || o.status}
                </Text>
              </View>
              {o.express ? <Text style={styles.express}>Gửi nhanh · ưu tiên</Text> : null}
              <Text style={styles.text}>
                {o.type === "RETURN" ? "Trả về: " : ""}
                {o.to.name}
                {o.to.phone ? ` · ${o.to.phone}` : ""}
              </Text>
              <Text style={styles.text}>{o.to.address}</Text>
              <Text style={styles.muted}>
                {o.item.name}
                {o.item.weightGram ? ` · ${o.item.weightGram} g` : ""}
                {o.type === "DELIVERY" ? ` · Lần giao ${o.attempts + 1}/${o.maxAttempts}` : ""}
              </Text>
              {o.item.note ? <Text style={styles.muted}>Lưu ý: {o.item.note}</Text> : null}
              {o.returnReason ? <Text style={styles.muted}>Lý do hoàn: {o.returnReason}</Text> : null}
              {o.returnHandedAt ? <Text style={styles.muted}>Đã trả — chờ người gửi xác nhận</Text> : null}
              {o.collect.total > 0 ? (
                <Text style={styles.collect}>
                  Thu của người nhận: {formatVnd(o.collect.total)}
                  {o.collect.fee ? ` (tiền hàng ${formatVnd(o.collect.cod)} + phí ${formatVnd(o.collect.fee)})` : ""}
                </Text>
              ) : null}
              {actions(o)}
              {action?.orderId === o.orderId && action.kind === "slip" ? (
                <>
                  {slipView()}
                  <Button title="Đóng phiếu" variant="secondary" size="sm" onPress={() => setAction(null)} />
                </>
              ) : null}
              {form(o)}
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
  editor: { gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginTop: 6 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  badge: { fontSize: 12, fontWeight: "700", color: colors.primary },
  failed: { color: colors.danger },
  express: { fontSize: 12, fontWeight: "700", color: colors.danger },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  collect: { fontSize: 14, fontWeight: "700", color: colors.text },
  counters: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  count: { fontSize: 14, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 8, marginTop: 6 },
  grow: { flexGrow: 1 },
  slip: { alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: radius.md, padding: 12, marginTop: 6 },
  slipTitle: { fontSize: 15, fontWeight: "800", letterSpacing: 1, color: colors.text },
  slipCode: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: 1 },
  qr: { width: 180, height: 180 },
});
