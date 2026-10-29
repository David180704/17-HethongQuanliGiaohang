import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../theme";

const VARIANTS = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: "#FFFFFF", border: colors.primary },
  secondary: { bg: colors.surface, pressed: colors.bg, fg: colors.text, border: colors.border },
  danger: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: "#FECACA" },
  // Nut dat tren thanh tieu de co mau (vd "Dang xuat")
  onDark: {
    bg: "rgba(255,255,255,0.14)",
    pressed: "rgba(255,255,255,0.28)",
    fg: "#FFFFFF",
    border: "rgba(255,255,255,0.4)",
  },
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const inactive = disabled || loading;

  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel || title}
      aria-disabled={inactive}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "sm" && styles.small,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Text style={[styles.text, size === "sm" && styles.smallText, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  small: { minHeight: 34, paddingHorizontal: 12, borderRadius: radius.sm },
  inactive: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: "600" },
  smallText: { fontSize: 13 },
});
