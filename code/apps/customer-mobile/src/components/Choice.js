import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

// Chon mot trong nhieu (radio) dang the bam duoc - de cham tren dien thoai.
// options: [{ value, label, hint?, disabled? }]; moi the co testID "<testID>-<value>".
export function ChoiceGroup({ label, options, value, onChange, testID }) {
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View role="radiogroup" aria-label={label} style={styles.options}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              testID={testID ? `${testID}-${option.value}` : undefined}
              role="radio"
              aria-checked={active}
              aria-disabled={Boolean(option.disabled)}
              aria-label={option.label}
              disabled={option.disabled}
              onPress={() => onChange(option.value)}
              style={[styles.option, active && styles.optionActive, option.disabled && styles.disabled]}
            >
              <View style={[styles.dot, active && styles.dotActive]} />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// O danh dau (checkbox).
export function Toggle({ label, value, onChange, testID }) {
  return (
    <Pressable
      testID={testID}
      role="checkbox"
      aria-checked={Boolean(value)}
      aria-label={label}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <View style={[styles.box, value && styles.boxOn]}>{value ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text },
  options: { gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.45 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.faint },
  dotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  hint: { fontSize: 12, color: colors.muted },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  toggleLabel: { fontSize: 14, color: colors.text, flexShrink: 1 },
});
