import { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../theme";

export default function TextField({ label, required = false, help, error, right, style, ...inputProps }) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        <TextInput
          aria-label={label || inputProps.placeholder}
          placeholderTextColor={colors.faint}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, Platform.OS === "web" && styles.webInput]}
        />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  required: { color: colors.danger },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  boxFocused: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 44, fontSize: 15, color: colors.text, paddingVertical: 10 },
  webInput: { outlineStyle: "none" },
  help: { fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: colors.danger },
});
