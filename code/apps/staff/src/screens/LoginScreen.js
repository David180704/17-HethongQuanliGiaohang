import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/apiClient";
import { API_URL } from "../config";
import { colors, radius } from "../theme";

// Chi co o ban dev (__DEV__): dien nhanh tai khoan seed de chuyen vai tro khi
// demo song song. Ban build that __DEV__ = false nen khoi nay khong hien.
const DEV_PASSWORD = "Password123!";
const DEV_ACCOUNTS = [
  { label: "Quản trị", email: "admin@edms.vn" },
  { label: "Nhân viên kho", email: "hubstaff1@edms.vn" },
  { label: "Tài xế", email: "shipper1@edms.vn" },
];

export default function LoginScreen() {
  const { login, bootError } = useAuth();
  const insets = useSafeAreaInsets();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!emailOrPhone.trim() || !password) {
      setError("Vui lòng nhập email/số điện thoại và mật khẩu");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(emailOrPhone, password);
      // Thanh cong -> App chuyen sang trang chu theo vai tro, man hinh nay unmount.
    } catch (err) {
      setError(errorMessage(err, "Đăng nhập thất bại"));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>E</Text>
          </View>
          <Text role="heading" style={styles.brandTitle}>
            EDMS Nhân viên
          </Text>
          <Text style={styles.brandSubtitle}>Quản trị viên · Nhân viên kho · Tài xế giao nhận</Text>
        </View>

        <View style={styles.card}>
          <TextField
            label="Email hoặc số điện thoại"
            placeholder="vd: shipper1@edms.vn"
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <TextField
            label="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable
                role="button"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <Text style={styles.reveal}>{showPassword ? "Ẩn" : "Hiện"}</Text>
              </Pressable>
            }
          />

          <Banner>{error || bootError}</Banner>

          <Button title="Đăng nhập" onPress={submit} loading={submitting} />

          {__DEV__ ? (
            <View style={styles.devBox}>
              <Text style={styles.devTitle}>Điền nhanh tài khoản demo (chỉ bản dev)</Text>
              <View style={styles.devRow}>
                {DEV_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    title={account.label}
                    accessibilityLabel={`Điền tài khoản ${account.label}`}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setEmailOrPhone(account.email);
                      setPassword(DEV_PASSWORD);
                      setError("");
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <Text style={styles.footer}>Khách hàng gửi và theo dõi đơn trên App Khách hàng.</Text>
        <Text style={styles.server}>Máy chủ: {API_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1E3A8A" },
  scroll: { flexGrow: 1, width: "100%", maxWidth: 440, alignSelf: "center", paddingHorizontal: 20, gap: 20 },
  brand: { alignItems: "center", gap: 6 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  logoText: { fontSize: 28, fontWeight: "800", color: "#1E3A8A" },
  brandTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  brandSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, gap: 16 },
  reveal: { color: colors.primary, fontWeight: "600", fontSize: 14, paddingLeft: 8 },
  devBox: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, gap: 10 },
  devTitle: { fontSize: 12, color: colors.muted },
  devRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 13 },
  server: { textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12 },
});
