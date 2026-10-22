import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Screen from "./Screen";
import Button from "./Button";
import TextField from "./TextField";
import Badge from "./Badge";
import Banner from "./Banner";
import ResourceForm from "./ResourceForm";
import { apiClient, errorMessage } from "../lib/apiClient";
import { confirmAsync } from "../lib/dialog";
import { colors, CONTENT_MAX_WIDTH, radius } from "../theme";

const PAGE_SIZE = 10;
const GAP = 12;

function cellText(column, item) {
  const value = column.format ? column.format(item) : item[column.key];
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

// config: { title, endpoint, columns: [{ key, label, format?, badge? }],
//   createFields, updateFields, searchPlaceholder, allowDelete }
// Cung cau truc voi ResourcePage ban web cu; bang doi thanh the (card) cho vua
// man hinh dien thoai, may tinh hien 2 cot.
export default function ResourceScreen({ config, accent, onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH) - 32;
  const cardWidth = wide ? (contentWidth - GAP) / 2 : contentWidth;

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null); // null = dong form, {} = tao moi, item = sua
  const requestSeq = useRef(0);
  const noticeTimer = useRef(null);

  // Go tim kiem: doi 400ms moi goi API, khong goi moi lan go mot phim.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const load = useCallback(
    async (page = 1, { pull = false } = {}) => {
      // Danh so tung request: ket qua cua lan tim cu ve tre thi bo, khong de
      // de len ket qua cua lan tim moi.
      const seq = ++requestSeq.current;
      if (pull) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await apiClient.get(config.endpoint, {
          params: { page, limit: PAGE_SIZE, search: query || undefined },
        });
        if (seq !== requestSeq.current) return;
        setItems(res.data.data);
        setMeta(res.data.meta);
      } catch (err) {
        if (seq === requestSeq.current) setError(errorMessage(err, "Không tải được dữ liệu"));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [config.endpoint, query],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  function flash(message) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2500);
  }

  async function handleSubmit(payload) {
    const isEdit = Boolean(editing?._id);
    if (isEdit) await apiClient.put(`${config.endpoint}/${editing._id}`, payload);
    else await apiClient.post(config.endpoint, payload);
    setEditing(null);
    flash(isEdit ? "Đã lưu thay đổi" : "Đã thêm mới");
    if (isEdit) {
      load(meta.page);
    } else if (query) {
      // Ban ghi moi nam dau trang 1 (sap xep moi nhat truoc) nhung co the khong
      // khop tu khoa dang tim -> xoa tim kiem de nguoi dung thay ngay.
      setSearchInput("");
      setQuery("");
    } else {
      load(1);
    }
  }

  async function handleDelete(item, name) {
    const confirmed = await confirmAsync(`Xóa "${name}"?`, "Hành động này không thể hoàn tác.", "Xóa");
    if (!confirmed) return;
    try {
      await apiClient.delete(`${config.endpoint}/${item._id}`);
      flash(`Đã xóa "${name}"`);
      // Xoa ban ghi cuoi cung cua trang -> lui ve trang truoc
      load(items.length === 1 && meta.page > 1 ? meta.page - 1 : meta.page);
    } catch (err) {
      setError(errorMessage(err, "Không xóa được"));
    }
  }

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const [firstColumn, ...otherColumns] = config.columns;

  function renderItem({ item }) {
    const name = cellText(firstColumn, item);
    return (
      <View style={[styles.card, { width: cardWidth }]}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {name}
        </Text>
        {otherColumns.map((column) => (
          <View key={column.key} style={styles.cardRow}>
            <Text style={styles.cardLabel}>{column.label}</Text>
            {column.badge ? (
              <Badge label={cellText(column, item)} tone={column.badge(item)} />
            ) : (
              <Text style={styles.cardValue} numberOfLines={1}>
                {cellText(column, item)}
              </Text>
            )}
          </View>
        ))}
        <View style={styles.cardActions}>
          <Button
            title="Sửa"
            variant="secondary"
            size="sm"
            accessibilityLabel={`Sửa ${name}`}
            onPress={() => setEditing(item)}
          />
          {config.allowDelete !== false ? (
            <Button
              title="Xóa"
              variant="danger"
              size="sm"
              accessibilityLabel={`Xóa ${name}`}
              onPress={() => handleDelete(item, name)}
            />
          ) : null}
        </View>
      </View>
    );
  }

  const header = (
    <View style={styles.toolbar}>
      <TextField
        placeholder={config.searchPlaceholder || "Tìm kiếm..."}
        value={searchInput}
        onChangeText={setSearchInput}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={styles.toolbarRow}>
        <View style={styles.totalBlock}>
          <Text style={styles.total}>
            Tổng {meta.total} bản ghi · trang {meta.page}/{totalPages}
          </Text>
          {loading && items.length > 0 ? <ActivityIndicator size="small" color={colors.muted} /> : null}
        </View>
        <View style={styles.toolbarActions}>
          <Button title="Làm mới" variant="secondary" size="sm" onPress={() => load(meta.page)} />
          <Button title="+ Thêm mới" size="sm" onPress={() => setEditing({})} />
        </View>
      </View>
      <Banner>{error}</Banner>
      <Banner tone="success">{notice}</Banner>
    </View>
  );

  const footer =
    meta.total > meta.limit ? (
      <View style={styles.pager}>
        <Button
          title="‹ Trước"
          accessibilityLabel="Trang trước"
          variant="secondary"
          size="sm"
          disabled={meta.page <= 1 || loading}
          onPress={() => load(meta.page - 1)}
        />
        <Text style={styles.pageText}>
          Trang {meta.page}/{totalPages}
        </Text>
        <Button
          title="Sau ›"
          accessibilityLabel="Trang sau"
          variant="secondary"
          size="sm"
          disabled={meta.page >= totalPages || loading}
          onPress={() => load(meta.page + 1)}
        />
      </View>
    ) : null;

  const empty = loading ? (
    <ActivityIndicator style={styles.spinner} color={colors.primary} />
  ) : (
    <Text style={styles.empty}>{query ? `Không tìm thấy kết quả cho "${query}"` : "Chưa có dữ liệu"}</Text>
  );

  const isEdit = Boolean(editing?._id);

  return (
    <Screen title={config.title} subtitle="Danh mục quản trị" accent={accent} onBack={onBack} scroll={false}>
      <FlatList
        key={wide ? "two-columns" : "one-column"}
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        numColumns={wide ? 2 : 1}
        columnWrapperStyle={wide ? styles.columnWrapper : undefined}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          Platform.OS === "web" ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={() => load(meta.page, { pull: true })} />
          )
        }
      />

      <Modal visible={Boolean(editing)} transparent animationType={wide ? "fade" : "slide"} onRequestClose={() => setEditing(null)}>
        <View style={[styles.backdrop, wide ? styles.backdropCenter : styles.backdropBottom]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.sheet, wide ? styles.sheetWide : { paddingBottom: insets.bottom }]}
          >
            <View style={styles.sheetHeader}>
              <Text role="heading" style={styles.sheetTitle}>
                {isEdit ? `Sửa ${config.title.toLowerCase()}` : `Thêm ${config.title.toLowerCase()}`}
              </Text>
            </View>
            {editing ? (
              <ResourceForm
                key={editing._id || "new"}
                fields={isEdit ? config.updateFields : config.createFields}
                initialValues={editing}
                onSubmit={handleSubmit}
                onCancel={() => setEditing(null)}
              />
            ) : null}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", padding: 16, gap: GAP },
  columnWrapper: { gap: GAP },
  toolbar: { gap: 12, marginBottom: 4 },
  toolbarRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  totalBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  total: { fontSize: 13, color: colors.muted },
  toolbarActions: { flexDirection: "row", gap: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  cardLabel: { fontSize: 13, color: colors.muted },
  cardValue: { fontSize: 14, color: colors.text, flexShrink: 1, textAlign: "right" },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 8 },
  pageText: { fontSize: 14, color: colors.text },
  spinner: { marginTop: 40 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)" },
  backdropBottom: { justifyContent: "flex-end" },
  backdropCenter: { justifyContent: "center", alignItems: "center", padding: 24 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "90%",
    width: "100%",
  },
  sheetWide: { maxWidth: 560, borderRadius: 18, maxHeight: "85%" },
  sheetHeader: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.border },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
});
