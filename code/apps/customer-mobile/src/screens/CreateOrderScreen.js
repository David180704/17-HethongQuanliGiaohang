import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Banner from "../components/Banner";
import Button from "../components/Button";
import { useAuth } from "../auth/AuthContext";
import { colors, radius } from "../theme";

// Man hinh da duoc bao ve (phai dang nhap). Nghiep vu tao don thuoc #18 (Sprint 3), backend
// chua co - hien khung 4 buoc de nguoi dung biet luong se dien ra (giong Web Khach hang).
const STEPS = [
  { title: "Người gửi & lấy hàng", text: "Chọn địa điểm lấy hàng đã lưu (tối đa 10)." },
  { title: "Người nhận", text: "Địa chỉ phải thuộc vùng phục vụ." },
  { title: "Hàng hóa", text: "Khối lượng, kích thước, hàng dễ vỡ/giá trị cao." },
  { title: "Dịch vụ & thanh toán", text: "Gửi thường/nhanh, thu hộ COD, ai trả phí ship." },
];

export default function CreateOrderScreen({ onBack, onGoTab }) {
  const { user } = useAuth();

  return (
    <Screen title="Tạo đơn hàng" subtitle={`Đang đăng nhập: ${user?.fullName || ""}`} onBack={onBack}>
      <Banner tone="warning" testID="create-order-notice">
        Chức năng tạo đơn đang được phát triển (hạng mục #18 · Sprint 3). Khi hoàn thành, đơn sẽ được tạo ngay tại màn
        hình này qua 4 bước dưới đây.
      </Banner>
      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.number}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.text}>{step.text}</Text>
          </View>
        </View>
      ))}
      <Button title="Xem bảng giá" onPress={() => onGoTab("pricing")} />
      <Button title="Kiểm tra vùng phục vụ" variant="secondary" onPress={() => onGoTab("coverage")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    opacity: 0.85,
  },
  number: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontWeight: "800", color: colors.muted },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  text: { fontSize: 14, color: colors.muted },
});
