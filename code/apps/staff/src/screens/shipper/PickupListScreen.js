import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Banner from "../../components/Banner";
import Button from "../../components/Button";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatVnd } from "../../lib/format";
import { formatPosition, getPosition, loadPosition } from "../../lib/location";
import { colors, radius } from "../../theme";

const ASSIGNMENT_LABEL = { ASSIGNED: "Cần lấy", DONE: "Đã lấy", FAILED: "Lấy không được" };

// US-27: don can lay cua chinh tai xe hom nay, mac dinh loc theo ca hien tai (doi sang ca khac / ca ngay).
// US-28: tai xe quet / nhap ma van don tren kien de xac nhan da lay (ghi toa do gia lap va thoi gian), hoac ghi
// nhan khong lay duoc kem nguyen nhan bat buoc.
export default function PickupListScreen({ accent, onBack }) {
  const [shiftId, setShiftId] = useState(null); // null = server tu chon ca hien tai
  const [data, setData] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [action, setAction] = useState(null); // { orderId, trackingCode, kind: "picked"|"failed", code, reason, note }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPositionState] = useState(getPosition());

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/assignments/mine/pickups", { params: shiftId ? { shiftId } : {} });
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được đơn cần lấy"));
    }
  }, [shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPosition().then(setPositionState);
    apiClient
      .get("/assignments/pickup-fail-reasons")
      .then((res) => setReasons(res.data.data))
      .catch(() => {});
  }, []);

  function open(order, kind) {
    setError("");
    setNotice("");
    setPositionState(getPosition());
    setAction({ orderId: order.orderId, trackingCode: order.trackingCode, kind, code: "", reason: "", note: "" });
  }

  async function submit() {
    setBusy(true);
    setError("");
    const { lat, lng } = getPosition();
    try {
      if (action.kind === "picked") {
        await apiClient.post(`/assignments/pickups/${action.orderId}/picked`, { code: action.code, lat, lng });
        setNotice(`Đã lấy hàng ${action.trackingCode}`);
      } else {
        await apiClient.post(`/assignments/pickups/${action.orderId}/failed`, { reason: action.reason, note: action.note, lat, lng });
        setNotice(`Đã ghi nhận không lấy được ${action.trackingCode}`);
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
        ...data.shifts.map((s) => ({
          value: s._id,
          label: `${s.name} ${s.startTime}–${s.endTime}${s._id === data.currentShiftId ? " (hiện tại)" : ""}`,
        })),
        { value: "all", label: "Cả ngày" },
      ]
    : [];

  const form = (o) =>
    action?.orderId === o.orderId ? (
      <View style={styles.editor} testID="pickup-form">
        <Text style={styles.muted} testID="pickup-position">
          Vị trí (giả lập): {formatPosition(position)} · {position.label}
        </Text>
        {action.kind === "picked" ? (
          <TextField
            testID="pickup-code"
            label="Quét / nhập mã vận đơn trên kiện"
            required
            autoCapitalize="characters"
            placeholder="EXP..."
            value={action.code}
            onChangeText={(code) => setAction({ ...action, code })}
          />
        ) : (
          <>
            <ChipSelect
              testID="pickup-reason"
              label="Nguyên nhân"
              required
              options={reasons.map((r) => ({ value: r.code, label: r.label }))}
              value={action.reason}
              onChange={(reason) => setAction({ ...action, reason })}
            />
            <TextField
              testID="pickup-note"
              label={action.reason === "OTHER" ? "Ghi rõ nguyên nhân" : "Ghi chú (tuỳ chọn)"}
              required={action.reason === "OTHER"}
              value={action.note}
              onChangeText={(note) => setAction({ ...action, note })}
            />
          </>
        )}
        <View style={styles.row}>
          <Button
            testID="pickup-submit"
            title={action.kind === "picked" ? "Xác nhận đã lấy" : "Ghi nhận không lấy được"}
            variant={action.kind === "picked" ? "primary" : "danger"}
            loading={busy}
            onPress={submit}
            style={styles.grow}
          />
          <Button title="Hủy" variant="secondary" onPress={() => setAction(null)} style={styles.grow} />
        </View>
      </View>
    ) : null;

  return (
    <Screen title="Đơn cần lấy" subtitle="Đơn được phân công lấy hàng hôm nay" accent={accent} onBack={onBack}>
      <Banner testID="pickup-error">{error}</Banner>
      <Banner tone="success" testID="pickup-notice">
        {notice}
      </Banner>
      {data === null ? <Text style={styles.muted}>Đang tải...</Text> : null}
      {data ? (
        <>
          {data.shifts.length ? (
            <ChipSelect testID="pickup-shift" label="Ca" options={options} value={data.selectedShiftId || "all"} onChange={setShiftId} />
          ) : (
            <Text style={styles.muted}>Hôm nay bạn chưa có ca trực.</Text>
          )}
          <View style={styles.counters} testID="pickup-counts">
            <Text style={styles.count}>Cần lấy: {data.counts.toPick}</Text>
            <Text style={styles.count}>Đã lấy: {data.counts.done}</Text>
            <Text style={styles.count}>Không lấy được: {data.counts.failed}</Text>
          </View>
          {data.orders.length === 0 ? (
            <Text style={styles.muted} testID="pickup-empty">
              Chưa có đơn cần lấy trong ca này.
            </Text>
          ) : null}
          {data.orders.map((o) => (
            <View key={o.assignmentId} style={styles.card} testID={`pickup-${o.trackingCode}`}>
              <View style={styles.head}>
                <Text style={styles.title}>{o.trackingCode}</Text>
                <Text style={[styles.badge, o.assignmentStatus === "FAILED" && styles.failed]}>
                  {ASSIGNMENT_LABEL[o.assignmentStatus] || o.assignmentStatus}
                </Text>
              </View>
              <Text style={styles.text}>{o.customerName}</Text>
              <Text style={styles.text}>{o.pickup.address}</Text>
              {o.pickup.contactName ? (
                <Text style={styles.muted}>
                  Liên hệ: {o.pickup.contactName} · {o.pickup.contactPhone}
                </Text>
              ) : null}
              <Text style={styles.muted}>
                {o.item.name}
                {o.item.weightGram ? ` · ${o.item.weightGram} g` : ""}
                {o.cod ? ` · Thu hộ khi giao ${formatVnd(o.cod)}` : ""}
                {o.method === "MANUAL" ? " · Kho điều chỉnh" : ""}
              </Text>
              {o.assignmentStatus === "ASSIGNED" && o.status === "PICKUP_ASSIGNED" && action?.orderId !== o.orderId ? (
                <View style={styles.row}>
                  <Button
                    title="Đã lấy hàng"
                    size="sm"
                    accessibilityLabel={`Đã lấy hàng ${o.trackingCode}`}
                    onPress={() => open(o, "picked")}
                    style={styles.grow}
                  />
                  <Button
                    title="Không lấy được"
                    size="sm"
                    variant="danger"
                    accessibilityLabel={`Không lấy được ${o.trackingCode}`}
                    onPress={() => open(o, "failed")}
                    style={styles.grow}
                  />
                </View>
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
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  counters: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  count: { fontSize: 14, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 6 },
  grow: { flex: 1 },
});
