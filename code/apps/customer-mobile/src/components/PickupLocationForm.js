import { useState } from "react";
import { StyleSheet, View } from "react-native";
import TextField from "./TextField";
import Button from "./Button";
import Banner from "./Banner";
import AddressFields from "./AddressFields";
import { apiClient, errorMessage } from "../lib/apiClient";
import { queryCache } from "../lib/queryCache";

const EMPTY = { label: "", contactName: "", contactPhone: "", address: "", province: "", district: "", ward: "" };

const pick = (location) =>
  location ? Object.fromEntries(Object.keys(EMPTY).map((key) => [key, location[key] ?? ""])) : {};

// Them / sua dia diem lay hang (US-15) - cung luat voi Web Khach hang: server tu
// xac dinh khu vuc phuc vu, ngoai vung thi bao loi ngay tren form.
export default function PickupLocationForm({ initial, onSaved, onCancel, submitLabel = "Lưu địa điểm" }) {
  const isEdit = Boolean(initial?._id);
  const [form, setForm] = useState(() => ({ ...EMPTY, ...pick(initial) }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const res = isEdit
        ? await apiClient.put(`/pickupLocations/${initial._id}`, form)
        : await apiClient.post("/pickupLocations", form);
      queryCache.invalidate("/pickupLocations");
      onSaved?.(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không lưu được địa điểm"));
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        testID="pl-label"
        label="Tên gợi nhớ"
        placeholder="Kho chính, Cửa hàng Cầu Giấy..."
        value={form.label}
        onChangeText={(text) => update({ label: text })}
      />
      <TextField
        testID="pl-contactName"
        label="Người liên hệ"
        value={form.contactName}
        onChangeText={(text) => update({ contactName: text })}
        autoCapitalize="words"
      />
      <TextField
        testID="pl-contactPhone"
        label="Số điện thoại liên hệ"
        value={form.contactPhone}
        onChangeText={(text) => update({ contactPhone: text })}
        keyboardType="phone-pad"
      />
      <AddressFields idPrefix="pl" value={form} onChange={update} />
      <Banner testID="pl-error">{error}</Banner>
      <View style={styles.actions}>
        {onCancel ? <Button title="Hủy" variant="secondary" onPress={onCancel} style={styles.action} /> : null}
        <Button testID="pl-save" title={submitLabel} onPress={submit} loading={saving} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
});
