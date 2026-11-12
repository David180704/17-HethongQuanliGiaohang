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

const STATUS_FILTERS = [
  { value: "OPEN", label: "Mới ghi nhận" },
  { value: "IN_PROGRESS", label: "Đang xử lý" },
  { value: "RESOLVED", label: "Đã giải quyết" },
  { value: "", label: "Tất cả" },
];
const SOURCES = [
  { value: "STAFF", label: "Nhân viên phát hiện" },
  { value: "SHOP", label: "Người gửi báo" },
  { value: "RECIPIENT", label: "Người nhận báo" },
];
const EMPTY = { trackingCode: "", type: "", source: "STAFF", description: "" };
const time = (value) => new Date(value).toLocaleString("vi-VN", { hour12: false });

// US-38 (de 02): kho / quan tri vien ghi nhan su co, khieu nai (that lac, hu hong, sai thong tin, khieu nai),
// theo doi tinh trang xu ly va ghi ket qua giai quyet (kem boi thuong neu co - vao ky doi soat cua shop).
export default function IncidentsScreen({ accent, onBack }) {
  const [status, setStatus] = useState("OPEN");
  const [data, setData] = useState(null);
  const [types, setTypes] = useState([]);
  const [creating, setCreating] = useState(null);
  const [action, setAction] = useState(null); // { id, kind: progress|resolve, note, result, compensation }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/incidents", { params: { status: status || undefined, limit: 50 } });
      setData({ items: res.data.data, total: res.data.meta.total });
    } catch (err) {
      setError(errorMessage(err, "Không tải được danh sách sự cố"));
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient
      .get("/incidents/types")
      .then((res) => setTypes(res.data.data))
      .catch(() => {});
  }, []);

  async function run(work, message) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const text = await work();
      setNotice(text || message);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const res = await apiClient.post("/incidents", creating);
      setCreating(null);
      return `Đã ghi nhận sự cố ${res.data.data.code} cho đơn ${res.data.data.trackingCode}`;
    });

  const submitAction = () =>
    run(async () => {
      if (action.kind === "progress") {
        await apiClient.post(`/incidents/${action.id}/progress`, { note: action.note });
        setAction(null);
        return "Đã ghi tiến độ xử lý";
      }
      const res = await apiClient.post(`/incidents/${action.id}/resolve`, { result: action.result, compensation: action.compensation || 0 });
      setAction(null);
      return `Đã giải quyết ${res.data.data.code}`;
    });

  return (
    <Screen title="Sự cố, khiếu nại" subtitle="Ghi nhận, theo dõi xử lý và kết quả giải quyết" accent={accent} onBack={onBack}>
      <Banner testID="incident-error">{error}</Banner>
      <Banner tone="success" testID="incident-notice">
        {notice}
      </Banner>
      {creating ? (
        <View style={styles.editor} testID="incident-form">
          <TextField
            testID="incident-code"
            label="Mã vận đơn"
            required
            autoCapitalize="characters"
            placeholder="EXP..."
            value={creating.trackingCode}
            onChangeText={(trackingCode) => setCreating({ ...creating, trackingCode })}
          />
          <ChipSelect testID="incident-type" label="Loại sự cố" required options={types} value={creating.type} onChange={(type) => setCreating({ ...creating, type })} />
          <ChipSelect testID="incident-source" label="Nguồn báo" options={SOURCES} value={creating.source} onChange={(source) => setCreating({ ...creating, source })} />
          <TextField
            testID="incident-description"
            label="Nội dung sự cố"
            required
            multiline
            value={creating.description}
            onChangeText={(description) => setCreating({ ...creating, description })}
          />
          <View style={styles.row}>
            <Button testID="incident-save" title="Ghi nhận sự cố" loading={busy} onPress={create} style={styles.grow} />
            <Button title="Hủy" variant="secondary" onPress={() => setCreating(null)} style={styles.grow} />
          </View>
        </View>
      ) : (
        <Button testID="incident-add" title="+ Ghi nhận sự cố" onPress={() => setCreating(EMPTY)} />
      )}

      <ChipSelect testID="incident-filter" label="Tình trạng" options={STATUS_FILTERS} value={status} onChange={setStatus} />
      {data === null ? <Text style={styles.muted}>Đang tải...</Text> : <Text style={styles.muted} testID="incident-total">Tổng {data.total} sự cố</Text>}
      {data?.items.map((i) => (
        <View key={i._id} style={styles.card} testID={`incident-${i.code}`}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {i.code} · {i.trackingCode}
            </Text>
            <Text style={[styles.badge, i.status === "RESOLVED" && styles.done]}>{i.statusLabel}</Text>
          </View>
          <Text style={styles.text}>
            {i.typeLabel} · {SOURCES.find((s) => s.value === i.source)?.label}
          </Text>
          <Text style={styles.text}>{i.description}</Text>
          {i.history.slice(1).map((h) => (
            <Text key={`${h.status}-${h.at}`} style={styles.muted}>
              {time(h.at)} · {h.label}: {h.note}
            </Text>
          ))}
          {i.resolution?.compensation ? <Text style={styles.text}>Bồi thường: {formatVnd(i.resolution.compensation)}</Text> : null}
          {i.status !== "RESOLVED" && action?.id !== i._id ? (
            <View style={styles.row}>
              <Button
                title="Ghi tiến độ"
                size="sm"
                variant="secondary"
                accessibilityLabel={`Ghi tiến độ ${i.code}`}
                onPress={() => setAction({ id: i._id, kind: "progress", note: "" })}
                style={styles.grow}
              />
              <Button
                title="Giải quyết"
                size="sm"
                accessibilityLabel={`Giải quyết ${i.code}`}
                onPress={() => setAction({ id: i._id, kind: "resolve", result: "", compensation: "" })}
                style={styles.grow}
              />
            </View>
          ) : null}
          {action?.id === i._id ? (
            <View style={styles.editor}>
              {action.kind === "progress" ? (
                <TextField testID="incident-note" label="Nội dung xử lý" required value={action.note} onChangeText={(note) => setAction({ ...action, note })} />
              ) : (
                <>
                  <TextField testID="incident-result" label="Kết quả giải quyết" required value={action.result} onChangeText={(result) => setAction({ ...action, result })} />
                  <TextField
                    testID="incident-compensation"
                    label="Bồi thường cho người gửi (đ, nếu có)"
                    keyboardType="number-pad"
                    value={action.compensation}
                    onChangeText={(compensation) => setAction({ ...action, compensation })}
                  />
                </>
              )}
              <View style={styles.row}>
                <Button testID="incident-submit" title={action.kind === "progress" ? "Lưu tiến độ" : "Đã giải quyết"} loading={busy} onPress={submitAction} style={styles.grow} />
                <Button title="Hủy" variant="secondary" onPress={() => setAction(null)} style={styles.grow} />
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 4 },
  editor: { gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, marginTop: 6 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  badge: { fontSize: 12, fontWeight: "700", color: colors.danger },
  done: { color: colors.primary },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  grow: { flex: 1 },
});
