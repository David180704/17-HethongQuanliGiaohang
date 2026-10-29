import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

const TONES = {
  error: { bg: colors.dangerSoft, fg: "#991B1B", border: "#FECACA" },
  success: { bg: colors.successSoft, fg: "#14532D", border: "#BBF7D0" },
  info: { bg: colors.primarySoft, fg: "#1E3A8A", border: "#BFDBFE" },
  warning: { bg: colors.warningSoft, fg: "#78350F", border: "#FDE68A" },
};

// Khong co noi dung thi khong render gi - goi <Banner>{error}</Banner> thoai mai.
export default function Banner({ tone = "error", children }) {
  if (!children) return null;
  const palette = TONES[tone] || TONES.error;
  return (
    <View
      role={tone === "error" ? "alert" : "status"}
      style={[styles.box, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <Text style={[styles.text, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  text: { fontSize: 14, lineHeight: 20 },
});
