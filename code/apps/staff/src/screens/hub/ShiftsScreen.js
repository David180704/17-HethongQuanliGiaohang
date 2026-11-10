import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { confirmAsync } from "../../lib/dialog";
import { colors, radius } from "../../theme";

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const viDay = (iso) => iso.split("-").reverse().join("/");
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const EMPTY = { routeId: "", name: "Ca sáng", startTime: "08:00", endTime: "12:00", shipperIds: [] };

// US-23: ca lam viec theo ngay cho cac tuyen thuoc hub cua nhan vien kho (va buu cuc truc thuoc);
// gan nguoi giao hang phu trach tuyen. Server chan trung gio, nguoi khong thuoc tuyen.
export default function ShiftsScreen({ accent, onBack }) {
  const [day, setDay] = useState(isoDay(new Date()));
  const [shifts, setShifts] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(null); // null = dang dong; { id?, ...EMPTY }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/shifts", { params: { date: day } });
      setShifts(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được ca làm việc"));
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient
      .get("/shifts/options")
      .then((res) => setRoutes(res.data.data.routes))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const route = routes.find((r) => r._id === form?.routeId);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value, ...(key === "routeId" && { shipperIds: [] }) }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = { ...form, shiftDate: day };
      delete body.id;
      if (form.id) await apiClient.put(`/shifts/${form.id}`, body);
      else await apiClient.post("/shifts", body);
      setNotice(form.id ? `Đã sửa ${form.name}` : `Đã thêm ${form.name}`);
      setForm(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(shift) {
    if (!(await confirmAsync("Xóa ca?", `${shift.name} ${shift.startTime}–${shift.endTime} · ${shift.routeId.code}`, "Xóa"))) return;
    try {
      await apiClient.delete(`/shifts/${shift._id}`);
      setNotice(`Đã xóa ${shift.name}`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen title="Ca làm việc" subtitle="Xếp người giao hàng vào ca theo tuyến" accent={accent} onBack={onBack}>
      <View style={styles.dayRow}>
        <Button testID="shift-prev" title="‹ Trước" size="sm" variant="secondary" onPress={() => setDay(addDays(day, -1))} />
        <Text style={styles.day} testID="shift-day">
          {viDay(day)}
        </Text>
        <Button testID="shift-next" title="Sau ›" size="sm" variant="secondary" onPress={() => setDay(addDays(day, 1))} />
      </View>
      <Banner testID="shift-error">{error}</Banner>
      <Banner tone="success" testID="shift-notice">
        {notice}
      </Banner>

      {form ? (
        <View style={styles.card} testID="shift-form">
          <Text role="heading" style={styles.title}>
            {form.id ? "Sửa ca" : "Thêm ca"} · {viDay(day)}
          </Text>
          <ChipSelect
            testID="shift-route"
            label="Tuyến"
            required
            options={routes.map((r) => ({ value: r._id, label: r.code }))}
            value={form.routeId}
            onChange={set("routeId")}
          />
          <TextField testID="shift-name" label="Tên ca" required value={form.name} onChangeText={set("name")} />
          <View style={styles.row}>
            <TextField testID="shift-start" label="Bắt đầu (HH:mm)" required value={form.startTime} onChangeText={set("startTime")} style={styles.grow} />
            <TextField testID="shift-end" label="Kết thúc (HH:mm)" required value={form.endTime} onChangeText={set("endTime")} style={styles.grow} />
          </View>
          {route ? (
            <ChipSelect
              testID="shift-shipper"
              label="Người giao hàng phụ trách tuyến"
              multiple
              options={route.shippers.map((s) => ({ value: s._id, label: s.fullName }))}
              value={form.shipperIds}
              onChange={set("shipperIds")}
            />
          ) : null}
          <View style={styles.row}>
            <Button testID="shift-save" title="Lưu ca" loading={saving} onPress={save} style={styles.grow} />
            <Button title="Hủy" variant="secondary" onPress={() => setForm(null)} style={styles.grow} />
          </View>
        </View>
      ) : (
        <Button testID="shift-add" title="+ Thêm ca" onPress={() => { setNotice(""); setForm({ ...EMPTY, routeId: routes[0]?._id || "" }); }} />
      )}

      {shifts === null ? <Text style={styles.muted}>Đang tải...</Text> : null}
      {shifts?.length === 0 ? (
        <Text style={styles.muted} testID="shift-empty">
          Chưa có ca nào ngày {viDay(day)}.
        </Text>
      ) : null}
      {shifts?.map((shift) => (
        <View key={shift._id} style={styles.card} testID={`shift-${shift.code}`}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {shift.name} · {shift.startTime}–{shift.endTime}
            </Text>
            <Text style={styles.badge}>{shift.routeId?.code}</Text>
          </View>
          <Text style={styles.muted}>
            {shift.shipperIds.length ? shift.shipperIds.map((s) => s.fullName).join(", ") : "Chưa gán người giao hàng"}
          </Text>
          <View style={styles.row}>
            <Button
              title="Sửa"
              size="sm"
              variant="secondary"
              accessibilityLabel={`Sửa ${shift.code}`}
              onPress={() => {
                setNotice("");
                setForm({
                  id: shift._id,
                  routeId: shift.routeId?._id,
                  name: shift.name,
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  shipperIds: shift.shipperIds.map((s) => s._id),
                });
              }}
            />
            <Button title="Xóa" size="sm" variant="danger" accessibilityLabel={`Xóa ${shift.code}`} onPress={() => remove(shift)} />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  day: { fontSize: 17, fontWeight: "800", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  badge: { fontSize: 12, fontWeight: "700", color: colors.primary },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
