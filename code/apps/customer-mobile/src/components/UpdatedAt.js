import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatTime } from "../lib/format";
import { colors } from "../theme";

// Cho nguoi dung (va nguoi cham demo) thay du lieu lay tu cache, tu lam moi 30 giay/lan.
export default function UpdatedAt({ at, onRefresh }) {
  if (!at) return null;
  return (
    <View style={styles.row} testID="updated-at">
      <Text style={styles.text}>Cập nhật lúc {formatTime(at)} · tự làm mới mỗi 30 giây</Text>
      {onRefresh ? (
        <Pressable role="button" aria-label="Làm mới ngay" onPress={onRefresh} hitSlop={8}>
          <Text style={styles.link}>Làm mới</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  text: { fontSize: 12, color: colors.faint },
  link: { fontSize: 12, color: colors.primary, fontWeight: "700" },
});
