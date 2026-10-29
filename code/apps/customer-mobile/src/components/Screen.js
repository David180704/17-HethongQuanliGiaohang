import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, CONTENT_MAX_WIDTH } from "../theme";

// Khung chung: thanh tieu de mau cam + vung noi dung cuon duoc, gioi han be rong
// (tren trinh duyet may tinh khong bi keo gian het chieu ngang).
//   header: noi dung thay cho tieu de mac dinh (vd thanh thuong hieu o Trang chu)
//   bottomInset=false khi man hinh nam tren thanh tab (tab da chua phan an toan duoi)
export default function Screen({ title, subtitle, onBack, right, header, bottomInset = true, children }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInner}>
          {onBack ? (
            <Pressable
              testID="back-button"
              role="button"
              aria-label="Quay lại"
              onPress={onBack}
              hitSlop={12}
              style={styles.backButton}
            >
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
          {header || (
            <View style={styles.titleBlock}>
              <Text role="heading" style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}
          {right}
        </View>
      </View>

      {/* Android 15 (edge-to-edge) khong tu thu nho man hinh khi ban phim mo: thieu khung nay thi
          ban phim che o dang nhap o cuoi form dai (da gap o form dang ky doanh nghiep tren may ao). */}
      <KeyboardAvoidingView style={styles.body} behavior="padding">
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.content, { paddingBottom: (bottomInset ? insets.bottom : 0) + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.brand, paddingBottom: 12, paddingHorizontal: 16 },
  headerInner: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  backText: { color: "#FFFFFF", fontSize: 26, lineHeight: 28, marginTop: -2 },
  titleBlock: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 19, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.88)", fontSize: 13, marginTop: 2 },
  body: { flex: 1 },
  content: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", padding: 16, gap: 16 },
});
