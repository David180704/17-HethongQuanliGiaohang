import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { colors } from "./src/theme";

// App Khach hang (mobile) - cung thiet ke va luong voi Web Khach hang (apps/web).
// KHONG bat buoc dang nhap: khach vang lai xem bang gia, vung phuc vu; chi tao don moi can.
function Root() {
  const { booting } = useAuth();
  if (booting) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.splashText}>EDMS Khách hàng</Text>
      </View>
    );
  }
  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.brand },
  splashText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
});
