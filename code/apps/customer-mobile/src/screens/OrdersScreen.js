import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Button from "../components/Button";
import Banner from "../components/Banner";
import TextField from "../components/TextField";
import UpdatedAt from "../components/UpdatedAt";
import StatusBadge from "../components/StatusBadge";
import { useCachedQuery } from "../lib/useCachedQuery";
import { errorMessage } from "../lib/apiClient";
import { formatVnd } from "../lib/format";
import { GROUP_FILTERS, RANGE_FILTERS, formatDateTime, rangeFrom } from "../lib/orderView";
import { colors, radius } from "../theme";

const PAGE_SIZE = 10;

// US-20: danh sach don cua khach - loc nhom trang thai (4 nhom de 14), khoang thoi gian, tim ma van don /
// nguoi nhan. Cung API voi Web Khach hang (GET /orders?group&from&search), cache 30 giay.
export default function OrdersScreen({ onBack, onOpenOrder, onCreateOrder }) {
  const [group, setGroup] = useState("");
  const [range, setRange] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [pages, setPages] = useState(1);
  const days = RANGE_FILTERS.find((r) => r.code === range)?.days;
  const query = { group, from: rangeFrom(days), search, page: 1, limit: PAGE_SIZE * pages };
  const { data: orders, meta, error, updatedAt, refresh } = useCachedQuery("/orders", query);
  const filtered = Boolean(group || range || search);
  const total = meta?.total ?? 0;

  function clearFilters() {
    setGroup("");
    setRange("");
    setSearchText("");
    setSearch("");
    setPages(1);
  }

  return (
    <Screen title="Đơn hàng của tôi" subtitle="Trạng thái và hành trình từng đơn" onBack={onBack}>
      <ChipRow label="Nhóm trạng thái" testID="orders-group" items={GROUP_FILTERS} value={group} onChange={(v) => { setGroup(v); setPages(1); }} />
      <ChipRow label="Thời gian tạo" testID="orders-range" items={RANGE_FILTERS} value={range} onChange={(v) => { setRange(v); setPages(1); }} />
      <View style={styles.searchRow}>
        <TextField
          testID="orders-search"
          label="Tìm đơn"
          placeholder="Mã vận đơn hoặc tên người nhận"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => {
            setSearch(searchText.trim());
            setPages(1);
          }}
          style={styles.searchField}
        />
        <Button testID="orders-search-submit" title="Tìm" size="sm" onPress={() => { setSearch(searchText.trim()); setPages(1); }} />
      </View>
      {filtered ? <Button testID="orders-clear" title="Bỏ lọc" variant="secondary" size="sm" onPress={clearFilters} /> : null}

      <Banner>{error ? errorMessage(error, "Không tải được danh sách đơn") : ""}</Banner>
      {!orders && !error ? <Text style={styles.muted}>Đang tải...</Text> : null}

      {orders ? (
        <>
          <View style={styles.summary}>
            <Text style={styles.muted} testID="orders-total">
              {total} đơn
            </Text>
            <UpdatedAt at={updatedAt} onRefresh={refresh} />
          </View>
          {orders.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.muted} testID="orders-empty">
                {filtered ? "Không có đơn nào phù hợp bộ lọc." : "Bạn chưa có đơn hàng nào."}
              </Text>
              {!filtered ? <Button title="Tạo đơn đầu tiên" onPress={onCreateOrder} /> : null}
            </View>
          ) : (
            <View style={styles.list} role="list" aria-label="Danh sách đơn hàng">
              {orders.map((order) => (
                <Pressable
                  key={order._id}
                  testID={`order-${order.trackingCode}`}
                  role="button"
                  aria-label={`Đơn ${order.trackingCode}`}
                  onPress={() => onOpenOrder(order._id)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.code}>{order.trackingCode}</Text>
                    <StatusBadge display={order.display} />
                  </View>
                  <Text style={styles.receiver}>
                    {order.receiver.name} · {order.receiver.district}, {order.receiver.province}
                  </Text>
                  <View style={styles.cardFoot}>
                    <Text style={styles.small}>Tạo {formatDateTime(order.createdAt)}</Text>
                    <Text style={styles.fee}>
                      {formatVnd(order.fee.total)}
                      {order.cod?.enabled ? ` · thu hộ ${formatVnd(order.cod.amount)}` : ""}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          {orders.length < total ? (
            <Button testID="orders-more" title="Xem thêm" variant="secondary" onPress={() => setPages((p) => p + 1)} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function ChipRow({ label, items, value, onChange, testID }) {
  return (
    <View style={styles.chipBlock}>
      <Text style={styles.chipLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {items.map((item) => {
          const active = item.code === value;
          return (
            <Pressable
              key={item.code || "all"}
              testID={`${testID}-${item.code || "ALL"}`}
              role="radio"
              aria-checked={active}
              aria-label={item.label}
              onPress={() => onChange(item.code)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
  chipBlock: { gap: 6 },
  chipLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  chips: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  chipTextActive: { color: "#FFFFFF" },
  searchRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  searchField: { flex: 1 },
  summary: { gap: 4 },
  empty: { gap: 12, padding: 20, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.lg },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
  },
  cardPressed: { borderColor: colors.primary },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  code: { fontSize: 16, fontWeight: "800", color: colors.primary, letterSpacing: 0.3 },
  receiver: { fontSize: 14, color: colors.text },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  fee: { fontSize: 13, fontWeight: "700", color: colors.text },
});
