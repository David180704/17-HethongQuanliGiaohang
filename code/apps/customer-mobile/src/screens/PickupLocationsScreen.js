import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import Banner from "../components/Banner";
import PickupLocationForm from "../components/PickupLocationForm";
import { apiClient, errorMessage } from "../lib/apiClient";
import { queryCache } from "../lib/queryCache";
import { useCachedQuery } from "../lib/useCachedQuery";
import { confirmAsync } from "../lib/dialog";
import { colors, radius } from "../theme";

// Dia diem lay hang (US-15) - cung luat voi Web Khach hang: toi da 10, mot dia
// diem mac dinh, chan xoa / doi dia chi khi con don dang xu ly (server bao loi).
export default function PickupLocationsScreen({ onBack }) {
  const { data, meta, loading, error: loadError, refresh } = useCachedQuery("/pickupLocations");
  const locations = data || [];
  const max = meta?.max ?? 10;
  const full = locations.length >= max;
  const [editing, setEditing] = useState(null); // null = danh sach, {} = them moi, location = sua
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function done(message) {
    setEditing(null);
    setError("");
    setNotice(message);
    refresh();
  }

  async function act(request, message) {
    setNotice("");
    setError("");
    try {
      await request();
      queryCache.invalidate("/pickupLocations");
      done(message);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(location) {
    if (!(await confirmAsync(`Xóa "${location.label}"?`, "Đơn cũ vẫn giữ địa chỉ này.", "Xóa"))) return;
    act(() => apiClient.delete(`/pickupLocations/${location._id}`), `Đã xóa "${location.label}"`);
  }

  const subtitle = loading ? "Đang tải..." : `${locations.length}/${max} địa điểm`;

  if (editing) {
    return (
      <Screen title={editing._id ? "Sửa địa điểm" : "Thêm địa điểm"} subtitle={subtitle} onBack={() => setEditing(null)}>
        <PickupLocationForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => done(editing._id ? `Đã lưu "${saved.label}"` : `Đã thêm "${saved.label}"`)}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Địa điểm lấy hàng" subtitle={subtitle} onBack={onBack}>
      <Text style={styles.muted} testID="pl-count">
        {locations.length}/{max} địa điểm · shipper đến đây lấy hàng
      </Text>
      <Banner tone="success">{notice}</Banner>
      <Banner>{error || (loadError ? errorMessage(loadError, "Không tải được địa điểm lấy hàng") : "")}</Banner>
      <Button testID="pl-add" title="+ Thêm địa điểm" onPress={() => setEditing({})} disabled={full} />
      {full ? <Text style={styles.warning}>Đã đủ {max} địa điểm — xóa bớt địa điểm cũ để thêm mới.</Text> : null}
      {!loading && locations.length === 0 ? (
        <Text style={styles.muted}>Chưa có địa điểm. Địa điểm đầu tiên sẽ là mặc định khi tạo đơn.</Text>
      ) : null}

      {locations.map((location) => (
        <Card
          key={location._id}
          testID={`pl-item-${location.label}`}
          title={location.label}
          right={location.isDefault ? <Text style={styles.badge}>Mặc định</Text> : null}
        >
          <Text style={styles.line}>
            {location.contactName} · {location.contactPhone}
          </Text>
          <Text style={styles.muted}>
            {location.address}, {location.ward}, {location.district}, {location.province}
          </Text>
          <View style={styles.actions}>
            <Button
              title="Sửa"
              size="sm"
              variant="secondary"
              accessibilityLabel={`Sửa ${location.label}`}
              onPress={() => setEditing(location)}
            />
            {!location.isDefault ? (
              <Button
                title="Đặt mặc định"
                size="sm"
                variant="secondary"
                accessibilityLabel={`Đặt ${location.label} làm mặc định`}
                onPress={() =>
                  act(
                    () => apiClient.put(`/pickupLocations/${location._id}`, { isDefault: true }),
                    `"${location.label}" là địa điểm mặc định`,
                  )
                }
              />
            ) : null}
            <Button
              title="Xóa"
              size="sm"
              variant="danger"
              accessibilityLabel={`Xóa ${location.label}`}
              onPress={() => remove(location)}
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  line: { fontSize: 14, color: colors.text },
  warning: { fontSize: 13, color: colors.warning },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
