import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { colors, radius } from "../../theme";

const ENDPOINT = { RECEIVE: "/warehouse/receive", RECEIVE_DEST: "/warehouse/receive", SORT: "/warehouse/sort", DISPATCH: "/warehouse/dispatch" };

// US-41: quy trinh tai kho - nhan vien quet / nhap ma van don -> app hien buoc tiep theo (nhan vao kho, phan loai
// theo loai hang, xuat kho, nhan o kho dich) -> bam mot nut. Ben duoi: ton kho cua hub va hang sap toi.
export default function WarehouseScreen({ accent, onBack }) {
  const [code, setCode] = useState("");
  const [order, setOrder] = useState(null);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [stock, setStock] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStock = useCallback(async () => {
    try {
      const res = await apiClient.get("/warehouse/stock");
      setStock(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tải được tồn kho"));
    }
  }, []);

  useEffect(() => {
    loadStock();
    apiClient
      .get("/warehouse/categories")
      .then((res) => setCategories(res.data.data))
      .catch(() => {});
  }, [loadStock]);

  async function lookup(value = code) {
    setError("");
    setNotice("");
    setCategory("");
    setBusy(true);
    try {
      const res = await apiClient.get(`/warehouse/orders/${encodeURIComponent(value.trim())}`);
      setOrder(res.data.data);
      setCode(res.data.data.trackingCode);
    } catch (err) {
      setOrder(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function act() {
    setError("");
    setBusy(true);
    try {
      const res = await apiClient.post(ENDPOINT[order.action], { trackingCode: order.trackingCode, category });
      setOrder(res.data.data);
      setNotice(`${order.trackingCode}: ${res.data.data.done.note}`);
      setCategory("");
      await loadStock();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const row = (o, prefix) => (
    <Pressable
      key={o._id}
      role="button"
      aria-label={`Mở ${o.trackingCode}`}
      testID={`${prefix}-${o.trackingCode}`}
      onPress={() => lookup(o.trackingCode)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.grow}>
        <Text style={styles.code}>
          {o.trackingCode}
          {o.express ? <Text style={styles.express}>  Gửi nhanh · ưu tiên</Text> : null}
        </Text>
        <Text style={styles.muted}>
          {o.statusLabel}
          {o.itemCategoryLabel ? ` · ${o.itemCategoryLabel}` : ""} · đi {o.destHub?.name || o.receiver.province}
        </Text>
      </View>
      {o.actionLabel ? <Text style={styles.badge}>{o.actionLabel}</Text> : null}
    </Pressable>
  );

  return (
    <Screen title="Nhập / xuất kho" subtitle="Quét mã vận đơn: nhận, phân loại, xuất kho" accent={accent} onBack={onBack}>
      <View style={styles.search}>
        <TextField
          testID="wh-code"
          label="Quét / nhập mã vận đơn"
          autoCapitalize="characters"
          placeholder="EXP..."
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => lookup()}
          style={styles.grow}
        />
        <Button testID="wh-lookup" title="Tra" loading={busy && !order} onPress={() => lookup()} />
      </View>
      <Banner testID="wh-error">{error}</Banner>
      <Banner tone="success" testID="wh-notice">
        {notice}
      </Banner>

      {order ? (
        <View style={styles.card} testID="wh-result">
          <View style={styles.head}>
            <Text style={styles.title}>
              {order.trackingCode}
              {order.express ? <Text style={styles.express}>  Gửi nhanh · ưu tiên</Text> : null}
            </Text>
            <Text style={styles.badge}>{order.statusLabel}</Text>
          </View>
          <Text style={styles.text}>
            {order.customerName} → {order.receiver.ward}, {order.receiver.province}
          </Text>
          <Text style={styles.muted}>
            {order.item.name}
            {order.item.weightGram ? ` · ${order.item.weightGram} g` : ""} · {order.serviceName}
            {order.itemCategoryLabel ? ` · ${order.itemCategoryLabel}` : ""}
          </Text>
          <Text style={styles.muted}>
            Kho lấy: {order.pickupHub?.name || "?"} · Kho giao: {order.destHub?.name || "?"}
            {order.currentHub ? ` · Đang ở: ${order.currentHub.name}` : ""}
          </Text>
          {order.action === "SORT" ? (
            <ChipSelect
              testID="wh-category"
              label="Loại hàng"
              required
              options={categories.map((c) => ({ value: c.code, label: c.label }))}
              value={category}
              onChange={setCategory}
            />
          ) : null}
          {order.action ? (
            <Button testID="wh-action" title={order.actionLabel} loading={busy} onPress={act} />
          ) : (
            <Text style={styles.reason} testID="wh-reason">
              {order.reason}
            </Text>
          )}
        </View>
      ) : null}

      {stock ? (
        <>
          <Text style={styles.counts} testID="wh-counts">
            Đã nhập: {stock.counts.AT_HUB} · Đã phân loại: {stock.counts.SORTED} · Đến kho giao: {stock.counts.AT_DEST_HUB} · Sắp
            tới: {stock.counts.incoming}
          </Text>
          {stock.byCategory.length ? (
            <Text style={styles.muted}>Theo loại: {stock.byCategory.map((c) => `${c.label} ${c.total}`).join(" · ")}</Text>
          ) : null}
          <Text role="heading" style={styles.section}>
            Hàng sắp tới ({stock.incoming.length})
          </Text>
          {stock.incoming.slice(0, 30).map((o) => row(o, "wh-in"))}
          <Text role="heading" style={styles.section}>
            Đang trong kho ({stock.orders.length})
          </Text>
          {stock.orders.slice(0, 50).map((o) => row(o, "wh-stock"))}
        </>
      ) : (
        <Text style={styles.muted}>Đang tải tồn kho...</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  code: { fontSize: 14, fontWeight: "700", color: colors.text },
  badge: { fontSize: 12, fontWeight: "700", color: colors.primary },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  reason: { fontSize: 13, color: "#92400E" },
  express: { fontSize: 12, fontWeight: "800", color: "#B91C1C" },
  counts: { fontSize: 14, fontWeight: "700", color: colors.text },
  section: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  pressed: { backgroundColor: colors.bg },
  grow: { flex: 1 },
});
