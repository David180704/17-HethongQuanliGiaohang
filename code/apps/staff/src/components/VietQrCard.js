import { Image, StyleSheet, Text, View } from "react-native";
import Banner from "./Banner";
import { formatVnd } from "../lib/format";
import { colors, radius } from "../theme";

// The ma VietQR chuyen khoan (may chu tu sinh, chuan Napas): khach mo app ngan hang bat ky quet, so tien va noi dung
// dien san. Dung o giao hang (nguoi nhan tra) va tiep nhan tai quay (nguoi gui tra truoc).
// data: { qr, amount, note, bank: { name, accountNo, accountName }, demo }; testID -> <testID>-card/-image/-amount/-note/-demo
export default function VietQrCard({ data, testID }) {
  const id = (suffix) => (testID ? `${testID}-${suffix}` : undefined);
  return (
    <View style={styles.card} testID={id("card")}>
      {data.demo ? (
        <Banner tone="warning" testID={id("demo")}>
          Tài khoản DEMO (máy chủ chưa cấu hình tài khoản công ty) — chỉ để xem, không chuyển tiền.
        </Banner>
      ) : null}
      <Image source={{ uri: data.qr }} style={styles.qr} accessibilityLabel="Mã VietQR chuyển khoản" testID={id("image")} />
      <Text style={styles.amount} testID={id("amount")}>
        {formatVnd(data.amount)}
      </Text>
      <Text style={styles.muted}>
        {data.bank.name} · {data.bank.accountNo}
        {data.bank.accountName ? ` · ${data.bank.accountName}` : ""}
      </Text>
      <Text style={styles.muted} testID={id("note")}>
        Nội dung: {data.note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  qr: { width: 220, height: 220 },
  amount: { fontSize: 20, fontWeight: "800", color: colors.text },
  muted: { fontSize: 13, color: colors.muted, textAlign: "center" },
});
