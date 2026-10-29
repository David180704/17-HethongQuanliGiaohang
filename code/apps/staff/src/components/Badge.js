import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const TONES = {
  success: { bg: colors.successSoft, fg: colors.success },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.primarySoft, fg: colors.primary },
  neutral: { bg: "#EEF2F6", fg: colors.muted },
};

export default function Badge({ label, tone = "neutral" }) {
  const palette = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: "600" },
});
