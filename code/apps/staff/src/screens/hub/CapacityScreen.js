import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { colors, radius } from "../../theme";

const SOURCE = { USER: "riêng", ROUTE: "theo tuyến", SYSTEM: "mặc định" };
const asText = (value) => (value === null || value === undefined ? "" : String(value));
// O trong = bo ghi de (chi voi nguoi giao hang); so thi gui nguyen so, server kiem 1..500
const asValue = (text, allowEmpty) => (text.trim() === "" && allowEmpty ? null : Number(text));

// US-24: nang luc toi da moi ca, uu tien rieng nguoi giao hang -> tuyen -> mac dinh he thong.
// Nhan vien kho doi nang luc tuyen / nguoi giao hang thuoc hub minh; quan tri vien doi them mac dinh he thong.
export default function CapacityScreen({ user, accent, onBack }) {
  const isAdmin = user.role === "ADMIN";
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null); // { kind: "system"|"route"|"shipper", id, label, pickup, delivery }
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/capacity");
      setData(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được năng lực"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function open(kind, target, label) {
    setNotice("");
    setError("");
    setEdit({ kind, id: target._id, label, pickup: asText(target.maxPickupPerShift), delivery: asText(target.maxDeliveryPerShift) });
  }

  async function save() {
    const allowEmpty = edit.kind === "shipper";
    const body = { maxPickupPerShift: asValue(edit.pickup, allowEmpty), maxDeliveryPerShift: asValue(edit.delivery, allowEmpty) };
    const url = { system: "/capacity/system", route: `/capacity/routes/${edit.id}`, shipper: `/capacity/shippers/${edit.id}` }[edit.kind];
    setSaving(true);
    setError("");
    try {
      await apiClient.put(url, body);
      setNotice(`Đã lưu năng lực ${edit.label}`);
      setEdit(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const editor = (key) =>
    edit && `${edit.kind}-${edit.id}` === key ? (
      <View style={styles.editor} testID="cap-form">
        <View style={styles.row}>
          <TextField
            testID="cap-pickup"
            label="Lấy tối đa / ca"
            keyboardType="number-pad"
            value={edit.pickup}
            onChangeText={(pickup) => setEdit({ ...edit, pickup })}
            style={styles.grow}
          />
          <TextField
            testID="cap-delivery"
            label="Giao tối đa / ca"
            keyboardType="number-pad"
            value={edit.delivery}
            onChangeText={(delivery) => setEdit({ ...edit, delivery })}
            style={styles.grow}
          />
        </View>
        {edit.kind === "shipper" ? <Text style={styles.muted}>Để trống = dùng năng lực của tuyến.</Text> : null}
        <View style={styles.row}>
          <Button testID="cap-save" title="Lưu" loading={saving} onPress={save} style={styles.grow} />
          <Button title="Hủy" variant="secondary" onPress={() => setEdit(null)} style={styles.grow} />
        </View>
      </View>
    ) : null;

  return (
    <Screen title="Năng lực phân công" subtitle="Số đơn tối đa một người nhận trong một ca" accent={accent} onBack={onBack}>
      <Banner testID="cap-error">{error}</Banner>
      <Banner tone="success" testID="cap-notice">
        {notice}
      </Banner>
      <Text style={styles.muted}>Ưu tiên: riêng người giao hàng → theo tuyến → mặc định hệ thống.</Text>
      {data === null ? <Text style={styles.muted}>Đang tải...</Text> : null}

      {data ? (
        <View style={styles.card} testID="cap-system">
          <View style={styles.head}>
            <Text style={styles.title}>Mặc định hệ thống</Text>
            {isAdmin ? (
              <Button testID="cap-system-edit" title="Sửa" size="sm" variant="secondary" onPress={() => open("system", { ...data.system, _id: "system" }, "mặc định hệ thống")} />
            ) : null}
          </View>
          <Text style={styles.muted}>
            Lấy {data.system.maxPickupPerShift} · Giao {data.system.maxDeliveryPerShift} đơn / ca
          </Text>
          {editor("system-system")}
        </View>
      ) : null}

      {data?.routes.map((route) => (
        <View key={route._id} style={styles.card} testID={`cap-route-${route.code}`}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {route.code} · {route.name}
            </Text>
            <Button
              title="Sửa"
              size="sm"
              variant="secondary"
              accessibilityLabel={`Sửa năng lực ${route.code}`}
              onPress={() => open("route", route, route.code)}
            />
          </View>
          <Text style={styles.muted}>
            Tuyến: lấy {route.maxPickupPerShift} · giao {route.maxDeliveryPerShift} đơn / ca
          </Text>
          {editor(`route-${route._id}`)}
          {route.shippers.length === 0 ? <Text style={styles.muted}>Chưa có người giao hàng phụ trách.</Text> : null}
          {route.shippers.map((s) => (
            <View key={s._id} style={styles.shipper} testID={`cap-shipper-${route.code}-${s.phone}`}>
              <View style={styles.head}>
                <View style={styles.grow}>
                  <Text style={styles.name}>{s.fullName}</Text>
                  <Text style={styles.muted}>
                    Lấy {s.pickup.value} ({SOURCE[s.pickup.source]}) · Giao {s.delivery.value} ({SOURCE[s.delivery.source]})
                  </Text>
                </View>
                <Button
                  title="Sửa"
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={`Sửa năng lực ${s.fullName}`}
                  onPress={() => open("shipper", s, s.fullName)}
                />
              </View>
              {editor(`shipper-${s._id}`)}
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  shipper: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 8 },
  editor: { gap: 8, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
});
