import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import UpdatedAt from "../components/UpdatedAt";
import { useCachedQuery } from "../lib/useCachedQuery";
import { formatVnd } from "../lib/format";
import { colors } from "../theme";

const day = (value) => {
  const d = new Date(new Date(value).getTime() + 7 * 3600e3).toISOString().slice(0, 10).split("-");
  return `${d[2]}/${d[1]}/${d[0]}`;
};

// US-43 (de 02): shop xem doi soat tren dien thoai - tung ky, tong thu ho, phi bi tru, dieu chinh, thuc nhan,
// giao dich chi tra; mo ky de xem tung don.
export default function SettlementsScreen({ onBack }) {
  const { data, loading, updatedAt, refresh } = useCachedQuery("/settlements");
  const [open, setOpen] = useState("");
  const list = data || [];
  return (
    <Screen title="Đối soát" subtitle="Thu hộ, phí, điều chỉnh và tiền thực nhận" onBack={onBack}>
      <UpdatedAt at={updatedAt} onRefresh={refresh} />
      {loading ? <Text style={styles.muted}>Đang tải...</Text> : null}
      {!loading && list.length === 0 ? <Text style={styles.muted} testID="settlement-empty">Chưa có kỳ đối soát nào.</Text> : null}
      {list.map((s) => (
        <Card key={s._id} title={`${s.code} · ${s.status === "PAID" ? "Đã chi trả" : "Chờ chi trả"}`} testID={`settlement-${s.code}`}>
          <Text style={styles.muted}>
            {day(s.periodFrom)} – {day(s.periodTo)} · {s.orderCount} đơn
          </Text>
          <Text style={styles.text}>Thu hộ: {formatVnd(s.totals.cod)}</Text>
          <Text style={styles.text}>Phí bị trừ: {formatVnd(s.totals.feeDeducted)}</Text>
          <Text style={styles.text}>Điều chỉnh: {formatVnd(s.totals.adjustments)}</Text>
          <Text style={styles.strong}>Thực nhận: {formatVnd(s.totals.netPayable)}</Text>
          {s.payment?.txnRef ? (
            <Text style={styles.paid}>
              Đã chuyển {formatVnd(s.payment.amount)} · {s.payment.bankName} {s.payment.accountNumber} · mã GD {s.payment.txnRef}
            </Text>
          ) : null}
          <Button title={open === s._id ? "Thu gọn" : "Xem từng đơn"} variant="secondary" onPress={() => setOpen(open === s._id ? "" : s._id)} />
          {open === s._id ? <Detail id={s._id} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

function Detail({ id }) {
  const { data } = useCachedQuery(`/settlements/${id}`);
  if (!data) return <Text style={styles.muted}>Đang tải...</Text>;
  return (
    <View style={styles.detail} testID="settlement-lines">
      {data.lines.map((l) => (
        <Text key={l.trackingCode} style={styles.muted}>
          {l.trackingCode} · {l.status === "RETURNED" ? "Đã hoàn" : "Đã giao"} · thu hộ {formatVnd(l.codCollected)} · trừ {formatVnd(l.feeDeducted)}
        </Text>
      ))}
      {data.adjustments.map((a) => (
        <Text key={`${a.reason}-${a.at}`} style={styles.text}>
          Điều chỉnh {formatVnd(a.amount)} · {a.reason}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: colors.muted },
  text: { fontSize: 14, color: colors.text },
  strong: { fontSize: 15, fontWeight: "800", color: colors.primary },
  paid: { fontSize: 13, color: colors.primaryPressed },
  detail: { gap: 4 },
});
