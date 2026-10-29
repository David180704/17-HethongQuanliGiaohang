import { StyleSheet, Text, View } from "react-native";
import { avatarLetter } from "../lib/format";
import { colors, radius } from "../theme";

// lines: [["Hub phụ trách", "Hub Hà Nội (HUB-HN)"], ...]
export default function ProfileCard({ user, theme, lines = [] }) {
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: theme.soft }]}>
        <Text style={[styles.avatarText, { color: theme.color }]}>{avatarLetter(user.fullName)}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.contact}>
          {user.email} · {user.phone}
        </Text>
        <View style={[styles.rolePill, { backgroundColor: theme.soft }]}>
          <Text style={[styles.roleText, { color: theme.color }]}>{theme.label}</Text>
        </View>
        {lines.map(([label, value]) => (
          <Text key={label} style={styles.line}>
            <Text style={styles.lineLabel}>{label}: </Text>
            {value}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={styles.section}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700" },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: "700", color: colors.text },
  contact: { fontSize: 13, color: colors.muted },
  rolePill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginTop: 2 },
  roleText: { fontSize: 12, fontWeight: "700" },
  line: { fontSize: 14, color: colors.text, marginTop: 2 },
  lineLabel: { color: colors.muted },
  section: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
});
