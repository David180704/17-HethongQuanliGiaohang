import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, CONTENT_MAX_WIDTH } from "../theme";

// Khung chung cho moi man hinh: thanh tieu de mang mau vai tro + vung noi dung
// gioi han be rong (tren man hinh may tinh khong bi keo gian het chieu ngang).
// scroll=false khi man hinh tu cuon bang FlatList (khong long FlatList trong ScrollView).
export default function Screen({ title, subtitle, accent = colors.primary, onBack, right, scroll = true, children }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { backgroundColor: accent, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerInner}>
          {onBack ? (
            <Pressable role="button" aria-label="Quay lại" onPress={onBack} hitSlop={12} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
          ) : null}
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
          {right}
        </View>
      </View>

      {scroll ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: 14, paddingHorizontal: 16 },
  headerInner: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  backText: { color: "#FFFFFF", fontSize: 26, lineHeight: 28, marginTop: -2 },
  titleBlock: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 19, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.82)", fontSize: 13, marginTop: 2 },
  body: { flex: 1 },
  content: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", padding: 16, gap: 16 },
});
