import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import TextField from "../components/TextField";
import Button from "../components/Button";
import Banner from "../components/Banner";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/apiClient";
import { colors, radius } from "../theme";

const CUSTOMER_TYPES = [
  { value: "INDIVIDUAL", label: "Cá nhân", hint: "Dùng được ngay sau khi đăng ký." },
  { value: "BUSINESS", label: "Doanh nghiệp / shop", hint: "Cần quản trị viên duyệt trước khi đăng nhập." },
];

const FIELDS = [
  { name: "fullName", label: "Họ tên", props: { autoCapitalize: "words", autoComplete: "name" } },
  { name: "email", label: "Email", props: { keyboardType: "email-address", autoCapitalize: "none", autoComplete: "email" } },
  { name: "phone", label: "Số điện thoại", props: { keyboardType: "phone-pad", autoComplete: "tel" } },
  { name: "password", label: "Mật khẩu", props: { secureTextEntry: true, autoCapitalize: "none", autoComplete: "new-password" } },
];
const BUSINESS_FIELDS = [
  { name: "shopName", label: "Tên shop / doanh nghiệp", props: {} },
  { name: "taxCode", label: "Mã số thuế", props: { keyboardType: "number-pad" } },
];

const EMPTY_FORM = { fullName: "", email: "", phone: "", password: "", shopName: "", taxCode: "" };

export default function RegisterScreen({ next, onBack, onLoggedIn, onLogin, onHome }) {
  const { register } = useAuth();
  const [customerType, setCustomerType] = useState("INDIVIDUAL");
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingBusiness, setPendingBusiness] = useState(null);

  const isBusiness = customerType === "BUSINESS";

  async function submit() {
    const fields = isBusiness ? [...FIELDS, ...BUSINESS_FIELDS] : FIELDS;
    const missing = fields.find((field) => !form[field.name].trim());
    if (missing) {
      setError(`Vui lòng nhập ${missing.label.toLowerCase()}`);
      return;
    }
    setError("");
    setSubmitting(true);
    const payload = {
      customerType,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      ...(isBusiness ? { shopName: form.shopName.trim(), taxCode: form.taxCode.trim() } : {}),
    };
    try {
      const created = await register(payload);
      // Ca nhan: register() da dang nhap luon -> ve man hinh dang mo truoc do.
      if (created.status === "ACTIVE") onLoggedIn(next);
      else setPendingBusiness(created);
    } catch (err) {
      setError(errorMessage(err, "Đăng ký thất bại"));
      setSubmitting(false);
    }
  }

  if (pendingBusiness) {
    return (
      <Screen title="Đăng ký" onBack={onBack}>
        <Banner tone="success" testID="register-pending">
          {`Đã gửi yêu cầu mở tài khoản doanh nghiệp cho ${pendingBusiness.email}. Quản trị viên sẽ duyệt và báo qua email; sau đó bạn đăng nhập để tạo đơn.`}
        </Banner>
        <Button title="Về trang chủ" onPress={onHome} />
      </Screen>
    );
  }

  return (
    <Screen title="Đăng ký" subtitle="Tạo tài khoản để gửi hàng và theo dõi đơn" onBack={onBack}>
      <Card>
        <View style={styles.segment} role="radiogroup" aria-label="Loại khách hàng">
          {CUSTOMER_TYPES.map((type) => {
            const active = type.value === customerType;
            return (
              <Pressable
                key={type.value}
                testID={`reg-type-${type.value}`}
                role="radio"
                aria-checked={active}
                aria-label={type.label}
                onPress={() => setCustomerType(type.value)}
                style={[styles.segmentItem, active && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{type.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{CUSTOMER_TYPES.find((t) => t.value === customerType).hint}</Text>

        <Banner testID="register-error">{error}</Banner>

        {(isBusiness ? [...FIELDS, ...BUSINESS_FIELDS] : FIELDS).map((field) => (
          <TextField
            key={field.name}
            testID={`reg-${field.name}`}
            label={field.label}
            value={form[field.name]}
            onChangeText={(value) => setForm((prev) => ({ ...prev, [field.name]: value }))}
            autoCorrect={false}
            {...field.props}
          />
        ))}

        <Button testID="reg-submit" title="Đăng ký" onPress={submit} loading={submitting} />
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Đã có tài khoản?</Text>
        <Pressable role="link" onPress={() => onLogin(next)} hitSlop={8}>
          <Text style={styles.footerLink}>Đăng nhập</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: colors.bg, borderRadius: radius.lg, padding: 4, gap: 4 },
  segmentItem: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: "center" },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  segmentTextActive: { color: colors.primary },
  hint: { fontSize: 12, color: colors.muted },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6 },
  footerText: { fontSize: 14, color: colors.muted },
  footerLink: { fontSize: 14, fontWeight: "700", color: colors.primary },
});
