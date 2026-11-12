import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Card from "./Card";
import Button from "./Button";
import Banner from "./Banner";
import TextField from "./TextField";
import { ChoiceGroup } from "./Choice";
import { apiClient, errorMessage } from "../lib/apiClient";
import { queryCache } from "../lib/queryCache";
import { useCachedQuery } from "../lib/useCachedQuery";
import { formatVnd } from "../lib/format";
import { formatDateTime } from "../lib/orderView";
import { colors } from "../theme";

// US-38 (de 02): shop bao su co / khieu nai tren dien thoai va theo doi tinh trang xu ly, ket qua giai quyet.
export default function IncidentCard({ orderId, onChanged }) {
  const { data: incidents, refresh } = useCachedQuery("/incidents", { orderId });
  const { data: types } = useCachedQuery("/incidents/types");
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ busy: false, error: "", message: "" });

  async function submit() {
    setState({ busy: true, error: "", message: "" });
    try {
      const res = await apiClient.post("/incidents", { orderId, type: form.type, description: form.description });
      queryCache.invalidate("/incidents");
      queryCache.invalidate("/orders");
      setForm(null);
      setState({ busy: false, error: "", message: `Đã gửi ${res.data.data.code} — Express sẽ xử lý và cập nhật tại đây` });
      refresh();
      onChanged?.();
    } catch (err) {
      setState({ busy: false, error: errorMessage(err), message: "" });
    }
  }

  return (
    <Card title="Sự cố, khiếu nại" testID="order-incidents">
      <Banner tone="success" testID="incident-message">
        {state.message}
      </Banner>
      {(incidents || []).map((i) => (
        <View key={i._id} style={styles.item} testID={`incident-${i.code}`}>
          <Text style={styles.strong}>
            {i.code} · {i.typeLabel} · {i.statusLabel}
          </Text>
          <Text style={styles.small}>{i.description}</Text>
          {i.history.slice(1).map((h) => (
            <Text key={`${h.status}-${h.at}`} style={styles.small}>
              {formatDateTime(h.at)} · {h.label}: {h.note}
            </Text>
          ))}
          {i.resolution?.compensation > 0 ? <Text style={styles.small}>Bồi thường {formatVnd(i.resolution.compensation)} — cộng vào kỳ đối soát</Text> : null}
        </View>
      ))}
      {!incidents?.length && !form ? <Text style={styles.small}>Chưa có sự cố nào với đơn này.</Text> : null}
      {form ? (
        <>
          <ChoiceGroup
            label="Loại sự cố"
            testID="incident-type"
            options={(types || []).filter((t) => t.value !== "RECIPIENT_COMPLAINT")}
            value={form.type}
            onChange={(type) => setForm({ ...form, type })}
          />
          <TextField testID="incident-description" label="Nội dung" multiline value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
          <Banner testID="incident-error">{state.error}</Banner>
          <Button testID="incident-submit" title="Gửi" onPress={submit} loading={state.busy} />
          <Button title="Hủy" variant="secondary" onPress={() => setForm(null)} />
        </>
      ) : (
        <Button testID="incident-open" title="Báo sự cố / khiếu nại" variant="secondary" onPress={() => setForm({ type: "", description: "" })} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { gap: 2, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  strong: { fontSize: 14, fontWeight: "700", color: colors.text },
  small: { fontSize: 13, color: colors.muted },
});
