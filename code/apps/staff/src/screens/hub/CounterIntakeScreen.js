import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import Button from "../../components/Button";
import Banner from "../../components/Banner";
import TextField from "../../components/TextField";
import ChipSelect from "../../components/ChipSelect";
import CheckboxRow from "../../components/CheckboxRow";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { queryCache } from "../../lib/queryCache";
import { colors, radius } from "../../theme";

const vnd = (amount) => `${String(Math.round(Number(amount) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
const FEE_PAYERS = [
  { value: "RECIPIENT_PAID", label: "Người nhận trả" },
  { value: "SHOP_PREPAID", label: "Người gửi trả trước" },
  { value: "DEDUCT_FROM_COD", label: "Trừ vào thu hộ" },
];
const METHODS = [
  { value: "CASH", label: "Tiền mặt tại quầy" },
  { value: "QR", label: "Chuyển khoản QR" },
];
const EMPTY = {
  phone: "",
  fullName: "",
  rcName: "",
  rcPhone: "",
  rcAddress: "",
  rcProvince: "",
  rcWard: "",
  itemName: "",
  weightGram: "",
  length: "",
  width: "",
  height: "",
  declaredValue: "",
  fragile: false,
  isVehicle: false,
  shopOrderCode: "",
  serviceTypeId: "",
  feePayer: "RECIPIENT_PAID",
  feePaymentMethod: "CASH",
  codEnabled: false,
  codAmount: "",
};

// US-40: tiep nhan hang tai quay (luong chinh de 14) - tim khach theo so dien thoai (chua co thi tao khach le),
// nhap nguoi nhan, kiem hang, bao gia tu diem cua nhan vien kem goi y phuong tien, chon nguoi tra phi, tao don.
// Don tao xong da nhan vao kho (AT_HUB), phi khoa ngay.
export default function CounterIntakeScreen({ user, accent, onBack }) {
  const [form, setForm] = useState(EMPTY);
  const [customer, setCustomer] = useState(null); // { found, customer? }
  const [quote, setQuote] = useState(null);
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const set = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (["weightGram", "length", "width", "height", "fragile", "isVehicle", "rcProvince", "rcWard", "declaredValue"].includes(key)) {
      setQuote(null);
    }
  };
  const item = () => ({
    name: form.itemName,
    weightGram: Number(form.weightGram),
    length: Number(form.length),
    width: Number(form.width),
    height: Number(form.height),
    declaredValue: Number(form.declaredValue) || 0,
  });

  async function run(kind, action) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  const lookup = () =>
    run("lookup", async () => {
      const res = await apiClient.get("/orders/counter/customers", { params: { phone: form.phone } });
      setCustomer(res.data.data);
    });

  const requestQuote = () =>
    run("quote", async () => {
      const res = await apiClient.post("/orders/counter/quote", {
        receiver: { province: form.rcProvince, ward: form.rcWard },
        item: item(),
        flags: { fragile: form.fragile, isVehicle: form.isVehicle },
      });
      setQuote(res.data.data);
      // Giu goi dang chon neu van dung duoc; giao nhanh lien tinh khong chon duoc -> lay goi dau tien dung duoc
      const usable = res.data.data.options.filter((o) => o.available !== false);
      setForm((current) => ({
        ...current,
        serviceTypeId: usable.some((o) => o.serviceTypeId === current.serviceTypeId) ? current.serviceTypeId : usable[0]?.serviceTypeId || "",
      }));
    });

  const submit = () =>
    run("submit", async () => {
      const res = await apiClient.post("/orders/counter", {
        customer: { phone: form.phone, fullName: form.fullName || undefined },
        serviceTypeId: form.serviceTypeId,
        receiver: {
          name: form.rcName,
          phone: form.rcPhone,
          address: form.rcAddress,
          province: form.rcProvince,
          ward: form.rcWard,
        },
        item: item(),
        flags: { fragile: form.fragile, isVehicle: form.isVehicle },
        shopOrderCode: form.shopOrderCode || undefined,
        cod: {
          enabled: form.codEnabled,
          amount: form.codEnabled ? Number(form.codAmount) : 0,
          feePayer: form.feePayer,
          feePaymentMethod: form.feePayer === "SHOP_PREPAID" ? form.feePaymentMethod : null,
        },
      });
      queryCache.invalidate("/orders");
      setCreated(res.data.data);
    });

  function startOver() {
    setForm(EMPTY);
    setCustomer(null);
    setQuote(null);
    setCreated(null);
    setError("");
  }

  if (created) {
    return (
      <Screen title="Đã tiếp nhận" accent={accent} onBack={onBack}>
        <View style={styles.card} testID="ci-created">
          <Text style={styles.muted}>Mã vận đơn — dán lên kiện hàng</Text>
          <Text style={styles.code} testID="ci-tracking-code">
            {created.trackingCode}
          </Text>
          <Text style={styles.line}>Trạng thái: {created.display.statusLabel} ({created.display.groupLabel})</Text>
          <Text style={styles.line}>Khách gửi: {created.customerName}{created.newCustomer ? " · khách lẻ mới" : ""}</Text>
          <Text style={styles.line}>Phí đã khóa: {vnd(created.fee.total)}{created.cod.feePaid ? " · đã thu tại quầy" : ""}</Text>
          <Text style={styles.line} testID="ci-created-vehicle">
            Phương tiện: {created.vehicleSuggestion.label} — {created.vehicleSuggestion.reason}
          </Text>
          <Button testID="ci-new" title="Tiếp nhận đơn khác" onPress={startOver} />
        </View>
      </Screen>
    );
  }

  const selected = quote?.options.find((o) => o.serviceTypeId === form.serviceTypeId);
  const hub = user.hubId;

  return (
    <Screen title="Tiếp nhận tại quầy" subtitle={hub ? `${hub.name} · nơi gửi` : undefined} accent={accent} onBack={onBack}>
      <Banner testID="ci-error">{error}</Banner>

      <Section title="1. Khách gửi">
        <View style={styles.row}>
          <TextField
            testID="ci-phone"
            label="Số điện thoại khách"
            required
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(value) => {
              set("phone")(value);
              setCustomer(null);
            }}
            style={styles.grow}
          />
          <Button testID="ci-lookup" title="Tìm khách" size="sm" loading={busy === "lookup"} onPress={lookup} />
        </View>
        {customer?.found ? (
          <Text style={styles.ok} testID="ci-customer">
            {customer.customer.shopName || customer.customer.fullName}
            {customer.customer.walkIn ? " · khách lẻ" : ""}
          </Text>
        ) : null}
        {customer && !customer.found ? (
          <TextField testID="ci-fullName" label="Họ tên khách (tạo khách lẻ)" required value={form.fullName} onChangeText={set("fullName")} />
        ) : null}
      </Section>

      <Section title="2. Người nhận">
        <TextField testID="ci-rc-name" label="Tên người nhận" required value={form.rcName} onChangeText={set("rcName")} />
        <TextField testID="ci-rc-phone" label="Số điện thoại" required keyboardType="phone-pad" value={form.rcPhone} onChangeText={set("rcPhone")} />
        <TextField testID="ci-rc-address" label="Địa chỉ (số nhà, đường)" required value={form.rcAddress} onChangeText={set("rcAddress")} />
        <TextField testID="ci-rc-province" label="Tỉnh/Thành phố" required value={form.rcProvince} onChangeText={set("rcProvince")} />
        <TextField
          testID="ci-rc-ward"
          label="Xã/Phường"
          required
          value={form.rcWard}
          onChangeText={set("rcWard")}
          help="Địa giới từ 01/07/2025, không còn quận/huyện. Gõ không dấu được, nhưng phải đúng xã/phường của tỉnh"
        />
      </Section>

      <Section title="3. Kiểm hàng và báo giá">
        <TextField testID="ci-item-name" label="Tên hàng" required value={form.itemName} onChangeText={set("itemName")} />
        <View style={styles.row}>
          <TextField testID="ci-weight" label="Khối lượng (g)" required keyboardType="numeric" value={form.weightGram} onChangeText={set("weightGram")} style={styles.grow} />
          <TextField testID="ci-declared" label="Giá trị (đ)" keyboardType="numeric" value={form.declaredValue} onChangeText={set("declaredValue")} style={styles.grow} />
        </View>
        <View style={styles.row}>
          <TextField testID="ci-length" label="Dài (cm)" required keyboardType="numeric" value={form.length} onChangeText={set("length")} style={styles.grow} />
          <TextField testID="ci-width" label="Rộng (cm)" required keyboardType="numeric" value={form.width} onChangeText={set("width")} style={styles.grow} />
          <TextField testID="ci-height" label="Cao (cm)" required keyboardType="numeric" value={form.height} onChangeText={set("height")} style={styles.grow} />
        </View>
        <CheckboxRow testID="ci-fragile" label="Hàng dễ vỡ" value={form.fragile} onChange={set("fragile")} />
        <CheckboxRow testID="ci-vehicle-item" label="Hàng là xe máy, xe điện" value={form.isVehicle} onChange={set("isVehicle")} />
        <TextField testID="ci-shop-code" label="Mã đơn của shop (nếu có)" value={form.shopOrderCode} onChangeText={set("shopOrderCode")} />
        <Button testID="ci-quote" title="Báo giá" variant="secondary" loading={busy === "quote"} onPress={requestQuote} />
        {quote ? (
          <View style={styles.quote}>
            <Text style={styles.vehicle} testID="ci-vehicle">
              Gợi ý phương tiện: {quote.vehicle.label} — {quote.vehicle.reason}
            </Text>
            <Text style={styles.muted}>
              {quote.receiverArea.ward}, {quote.receiverArea.province} · {quote.zoneLabel} · tính theo {quote.chargeableWeight} g
              {quote.distanceKm !== null && quote.distanceKm !== undefined ? ` · cách khoảng ${quote.distanceKm} km` : ""}
            </Text>
            {quote.options
              .filter((o) => o.available === false)
              .map((o) => (
                <Text key={o.code} style={styles.muted} testID={`ci-unavailable-${o.code}`}>
                  {o.reason}
                </Text>
              ))}
            <ChipSelect
              testID="ci-service"
              label="Dịch vụ"
              options={quote.options.filter((o) => o.available !== false).map((o) => ({ value: o.serviceTypeId, label: `${o.name} · ${vnd(o.fee.total)}` }))}
              value={form.serviceTypeId}
              onChange={set("serviceTypeId")}
            />
          </View>
        ) : null}
      </Section>

      <Section title="4. Thu tiền">
        <ChipSelect testID="ci-payer" label="Người trả phí" options={FEE_PAYERS} value={form.feePayer} onChange={set("feePayer")} />
        {form.feePayer === "SHOP_PREPAID" ? (
          <ChipSelect testID="ci-method" label="Hình thức" options={METHODS} value={form.feePaymentMethod} onChange={set("feePaymentMethod")} />
        ) : null}
        <CheckboxRow testID="ci-cod" label="Thu hộ tiền hàng (COD)" value={form.codEnabled} onChange={set("codEnabled")} />
        {form.codEnabled ? (
          <TextField testID="ci-cod-amount" label="Số tiền thu hộ (đ)" keyboardType="numeric" value={form.codAmount} onChangeText={set("codAmount")} />
        ) : null}
        {selected ? (
          <Text style={styles.total} testID="ci-total">
            Phí {selected.name}: {vnd(selected.fee.total)}
          </Text>
        ) : null}
        <Button
          testID="ci-submit"
          title="Tạo đơn và nhận hàng vào kho"
          loading={busy === "submit"}
          disabled={!quote || !form.serviceTypeId || !customer}
          onPress={submit}
        />
        {!quote || !customer ? <Text style={styles.muted}>Tìm khách và báo giá trước khi tạo đơn.</Text> : null}
      </Section>
    </Screen>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.card}>
      <Text role="heading" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  grow: { flex: 1 },
  muted: { fontSize: 13, color: colors.muted },
  ok: { fontSize: 14, fontWeight: "700", color: colors.success },
  quote: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.bg },
  vehicle: { fontSize: 14, fontWeight: "700", color: colors.text },
  total: { fontSize: 15, fontWeight: "800", color: colors.text },
  code: { fontSize: 26, fontWeight: "800", color: colors.primary, letterSpacing: 0.5 },
  line: { fontSize: 14, color: colors.text },
});
