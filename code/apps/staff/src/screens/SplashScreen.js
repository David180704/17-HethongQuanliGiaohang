import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function SplashScreen() {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.text}>Đang khôi phục phiên đăng nhập...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "#1E3A8A" },
  text: { color: "rgba(255,255,255,0.85)", fontSize: 14 },
});
