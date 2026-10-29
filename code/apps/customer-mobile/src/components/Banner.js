import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

const TONES = {
  error: { bg: colors.dangerSoft, fg: "#991B1B", border: "#FECACA" },
  success: { bg: colors.successSoft, fg: "#14532D", border: "#BBF7D0" },
  info: { bg: colors.primarySoft, fg: "#7C2D12", border: colors.primaryBorder },
  warning: { bg: colors.warningSoft, fg: "#78350F", border: "#FDE68A" },
};

// Khong co noi dung thi khong render gi - goi <Banner>{error}</Banner> thoai mai.
export default function Banner({ tone = "error", testID, children }) {
  if (!children) return null;
  const palette = TONES[tone] || TONES.error;
  return (
    <View
      testID={testID}
      role={tone === "error" ? "alert" : "status"}
      style={[styles.box, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      {typeof children === "string" ? <Text style={[styles.text, { color: palette.fg }]}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  text: { fontSize: 14, lineHeight: 20 },
});
