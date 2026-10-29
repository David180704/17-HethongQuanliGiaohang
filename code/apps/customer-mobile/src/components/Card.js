import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export default function Card({ title, right, children, style, testID }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {title ? (
        <View style={styles.head}>
          <Text role="heading" style={styles.title}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, flexShrink: 1 },
});
