import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import SplashScreen from "./src/screens/SplashScreen";
import StaffNavigator from "./src/navigation/StaffNavigator";

// App Nhan vien: BAT BUOC dang nhap. Chua dang nhap -> chi thay man hinh dang
// nhap; dang nhap xong -> giao dien theo vai tro (ADMIN / HUB_STAFF / SHIPPER).
function Root() {
  const { user, booting } = useAuth();
  if (booting) return <SplashScreen />;
  if (!user) return <LoginScreen />;
  return <StaffNavigator user={user} />;
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
