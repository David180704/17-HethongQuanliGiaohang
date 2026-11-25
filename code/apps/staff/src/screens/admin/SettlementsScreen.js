import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatVnd } from "../../lib/format";
import { colors, radius } from "../../theme";

const FILTERS = [
  { value: "PENDING", label: "Chờ chi trả" },
  { value: "PAID", label: "Đã chi trả" },
  { value: "", label: "Tất cả" },
];
const day = (value) => new Date(value).toLocaleDateString("vi-VN");
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;

// US-34, US-43 (de 02): ke toan (quan tri vien) lap ky doi soat cho khoang thoi gian (xem truoc tung shop), xem
// chi tiet tung don, them khoan dieu chinh khi ky cho chi tra va ghi nhan da chuyen tien vao tai khoan cua shop.
export default function SettlementsScreen({ accent, onBack }) {
  const [period, setPeriod] = useState({ from: monthStart(), to: today() });
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("PENDING");
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null); // ky dang xem chi tiet
  const [form, setForm] = useState({ amount: "", reason: "", txnRef: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList((await apiClient.get("/settlements", { params: { status: status || undefined, limit: 50 } })).data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được kỳ đối soát"));
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(work) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const message = await work();
      if (message) setNotice(message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const doPreview = () => run(async () => setPreview((await apiClient.post("/settlements/preview", period)).data.data));
  const doRun = () =>
    run(async () => {
      const created = (await apiClient.post("/settlements", period)).data.data;
      setPreview(null);
      setStatus("PENDING");
      await load();
      return `Đã lập ${created.length} kỳ đối soát: ${created.map((s) => s.code).join(", ")}`;
    });
  const openDetail = (id) =>
    run(async () => {
      setForm({ amount: "", reason: "", txnRef: "" });
      setOpen(open?._id === id ? null : (await apiClient.get(`/settlements/${id}`)).data.data);
    });
  const adjust = () =>
    run(async () => {
      setOpen((await apiClient.post(`/settlements/${open._id}/adjustments`, { amount: Number(form.amount), reason: form.reason })).data.data);
      setForm({ ...form, amount: "", reason: "" });
      await load();
      return "Đã thêm khoản điều chỉnh";
    });
  const pay = () =>
    run(async () => {
      const paid = (await apiClient.post(`/settlements/${open._id}/pay`, { txnRef: form.txnRef })).data.data;
      setOpen(paid);
      await load();
      return `Đã ghi nhận chi trả ${paid.code}: ${formatVnd(paid.payment.amount)}`;
    });

  const detail = (s) => (
    <View style={styles.editor} testID="settlement-detail">
      {s.lines.map((l) => (
        <Text key={l.trackingCode} style={styles.muted}>
          {l.trackingCode} · {l.status === "RETURNED" ? "Hoàn" : "Giao"} · thu hộ {formatVnd(l.codCollected)} · trừ phí {formatVnd(l.feeDeducted)}
        </Text>
      ))}
      {s.adjustments.map((a) => (
        <Text key={`${a.reason}-${a.at}`} style={styles.text}>
          Điều chỉnh {a.amount > 0 ? "+" : ""}
          {formatVnd(a.amount)} · {a.reason}
        </Text>
      ))}
      {s.status === "PENDING" ? (
        <>
          <View style={styles.row}>
            <TextField
              testID="settlement-adjust-amount"
              label="Điều chỉnh (đ, âm = trừ)"
              keyboardType="numbers-and-punctuation"
              value={form.amount}
              onChangeText={(amount) => setForm({ ...form, amount })}
              style={styles.grow}
            />
            <TextField testID="settlement-adjust-reason" label="Lý do" value={form.reason} onChangeText={(reason) => setForm({ ...form, reason })} style={styles.grow} />
          </View>
          <Button testID="settlement-adjust" title="Thêm điều chỉnh" variant="secondary" size="sm" loading={busy} onPress={adjust} />
          <TextField testID="settlement-txn" label="Mã giao dịch chuyển khoản" value={form.txnRef} onChangeText={(txnRef) => setForm({ ...form, txnRef })} />
          <Button testID="settlement-pay" title={`Ghi nhận đã chi ${formatVnd(s.totals.netPayable)}`} loading={busy} onPress={pay} />
        </>
      ) : (
        <Text style={styles.text} testID="settlement-payment">
          Đã chi {formatVnd(s.payment.amount)} · {s.payment.bankName || ""} {s.payment.accountNumber || ""} · mã GD {s.payment.txnRef}
        </Text>
      )}
    </View>
  );

  return (
    <Screen title="Đối soát" subtitle="Thu hộ, phí, điều chỉnh và chi trả cho shop" accent={accent} onBack={onBack}>
      <Banner testID="settlement-error">{error}</Banner>
      <Banner tone="success" testID="settlement-notice">
        {notice}
      </Banner>
      <View style={styles.card}>
        <Text style={styles.section}>Lập kỳ đối soát</Text>
        <View style={styles.row}>
          <TextField testID="settlement-from" label="Từ ngày" value={period.from} onChangeText={(from) => setPeriod({ ...period, from })} style={styles.grow} />
          <TextField testID="settlement-to" label="Đến ngày" value={period.to} onChangeText={(to) => setPeriod({ ...period, to })} style={styles.grow} />
        </View>
        <View style={styles.row}>
          <Button testID="settlement-preview" title="Xem trước" variant="secondary" loading={busy} onPress={doPreview} style={styles.grow} />
          <Button testID="settlement-run" title="Lập kỳ" loading={busy} onPress={doRun} style={styles.grow} />
        </View>
        {preview ? (
          <View testID="settlement-preview-list">
            {preview.length === 0 ? <Text style={styles.muted}>Không có đơn nào cần đối soát trong khoảng này.</Text> : null}
            {preview.map((p) => (
              <Text key={p.customerId} style={styles.muted}>
                {p.customerName}: {p.totals.orders} đơn · thu hộ {formatVnd(p.totals.cod)} · trừ phí {formatVnd(p.totals.feeDeducted)} · trả {formatVnd(p.totals.netPayable)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <ChipSelect testID="settlement-filter" label="Kỳ đối soát" options={FILTERS} value={status} onChange={setStatus} />
      {list === null ? <Text style={styles.muted}>Đang tải...</Text> : null}
      {list?.length === 0 ? <Text style={styles.muted}>Chưa có kỳ nào.</Text> : null}
      {list?.map((s) => (
        <View key={s._id} style={styles.card} testID={`settlement-${s.code}`}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {s.code} · {s.customerName}
            </Text>
            <Text style={[styles.badge, s.status === "PAID" && styles.paid]}>{s.status === "PAID" ? "Đã chi trả" : "Chờ chi trả"}</Text>
          </View>
          <Text style={styles.muted}>
            {day(s.periodFrom)} – {day(s.periodTo)} · {s.orderCount} đơn
          </Text>
          <Text style={styles.text}>
            Thu hộ {formatVnd(s.totals.cod)} − phí {formatVnd(s.totals.feeDeducted)} {s.totals.adjustments >= 0 ? "+" : "−"} điều chỉnh{" "}
            {formatVnd(Math.abs(s.totals.adjustments))} = <Text style={styles.strong}>{formatVnd(s.totals.netPayable)}</Text>
          </Text>
          <Button title={open?._id === s._id ? "Thu gọn" : "Chi tiết"} size="sm" variant="secondary" accessibilityLabel={`Chi tiết ${s.code}`} onPress={() => openDetail(s._id)} />
          {open?._id === s._id ? detail(open) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  editor: { gap: 6, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  section: { fontSize: 15, fontWeight: "800", color: colors.text },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  badge: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  paid: { color: colors.primary },
  text: { fontSize: 14, color: colors.text },
  strong: { fontWeight: "800" },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
