import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Banner from "../../components/Banner";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatVnd } from "../../lib/format";
import { colors, radius } from "../../theme";

const ASSIGNMENT_LABEL = { ASSIGNED: "Cần lấy", DONE: "Đã lấy", FAILED: "Lấy không được" };

// US-27: don can lay cua chinh tai xe hom nay, mac dinh loc theo ca hien tai (doi sang ca khac / ca ngay).
// Xac nhan da lay / khong lay duoc la US-28 (Sprint 5).
export default function PickupListScreen({ accent, onBack }) {
  const [shiftId, setShiftId] = useState(null); // null = server tu chon ca hien tai
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

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

  const options = data
    ? [
        ...data.shifts.map((s) => ({
          value: s._id,
          label: `${s.name} ${s.startTime}–${s.endTime}${s._id === data.currentShiftId ? " (hiện tại)" : ""}`,
        })),
        { value: "all", label: "Cả ngày" },
      ]
    : [];

  return (
    <Screen title="Đơn cần lấy" subtitle="Đơn được phân công lấy hàng hôm nay" accent={accent} onBack={onBack}>
      <Banner testID="pickup-error">{error}</Banner>
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
            <Text style={styles.count}>Tổng: {data.counts.total}</Text>
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
                <Text style={styles.badge}>{ASSIGNMENT_LABEL[o.assignmentStatus] || o.assignmentStatus}</Text>
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
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  badge: { fontSize: 12, fontWeight: "700", color: colors.primary },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  counters: { flexDirection: "row", gap: 16 },
  count: { fontSize: 14, fontWeight: "700", color: colors.text },
});
