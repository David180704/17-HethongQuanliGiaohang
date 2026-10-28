import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/apiClient";
import { API_URL } from "../config";
import { colors } from "../theme";

// Chi o ban dev (__DEV__): dien nhanh tai khoan seed de demo. Ban build that khong hien.
const DEV_PASSWORD = "123456";
const DEV_ACCOUNTS = [
  { label: "Khách cá nhân", email: "khach1@edms.vn" },
  { label: "Shop", email: "shop1@edms.vn" },
];

// next: man hinh mo tiep sau khi dang nhap (vd "createOrder" khi bam Tao don luc chua dang nhap).
export default function LoginScreen({ next, onBack, onLoggedIn, onRegister }) {
  const { login } = useAuth();
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
      onLoggedIn(next);
    } catch (err) {
      setError(errorMessage(err, "Đăng nhập thất bại"));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <Screen
        title="Đăng nhập"
        subtitle={next === "createOrder" ? "Đăng nhập để tạo đơn và thanh toán." : "Chào mừng bạn quay lại."}
        onBack={onBack}
      >
        <Card>
          <TextField
            testID="login-identity"
            label="Email hoặc số điện thoại"
            placeholder="vd: khach1@edms.vn"
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
            testID="login-password"
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
          <Banner testID="login-error">{error}</Banner>
          <Button testID="login-submit" title="Đăng nhập" onPress={submit} loading={submitting} />

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
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Chưa có tài khoản?</Text>
          <Pressable testID="go-register" role="link" onPress={() => onRegister(next)} hitSlop={8}>
            <Text style={styles.footerLink}>Đăng ký</Text>
          </Pressable>
        </View>
        <Text style={styles.small}>Nhân viên công ty dùng App Nhân viên.</Text>
        <Text style={styles.server}>Máy chủ: {API_URL}</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reveal: { color: colors.primary, fontWeight: "700", fontSize: 14, paddingLeft: 8 },
  devBox: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, gap: 8 },
  devTitle: { fontSize: 12, color: colors.muted },
  devRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6 },
  footerText: { fontSize: 14, color: colors.muted },
  footerLink: { fontSize: 14, fontWeight: "700", color: colors.primary },
  small: { textAlign: "center", fontSize: 12, color: colors.muted },
  server: { textAlign: "center", fontSize: 12, color: colors.faint },
});
