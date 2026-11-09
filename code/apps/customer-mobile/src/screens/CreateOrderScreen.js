import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import Banner from "../components/Banner";
import TextField from "../components/TextField";
import AddressFields from "../components/AddressFields";
import ParcelFields from "../components/ParcelFields";
import FeeBreakdown from "../components/FeeBreakdown";
import PickupLocationForm from "../components/PickupLocationForm";
import { ChoiceGroup, Toggle } from "../components/Choice";
import { apiClient, errorMessage } from "../lib/apiClient";
import { queryCache } from "../lib/queryCache";
import { useCachedQuery } from "../lib/useCachedQuery";
import { formatVnd, groupThousands } from "../lib/format";
import {
  EMPTY_ORDER,
  FEE_PAYERS,
  PREPAID_METHODS,
  codSummary,
  fromDraft,
  stepError,
  toFlagsPayload,
  toItemPayload,
  toOrderPayload,
} from "../lib/orderForm";
import { colors, radius } from "../theme";

const STEP_TITLES = ["Lấy hàng", "Người nhận", "Hàng hóa & thanh toán", "Xác nhận"];

// Tao don 4 buoc (US-18) - cung luong voi Web Khach hang: thu ho va ai tra phi (US-19), phi
// du kien truoc khi xac nhan (US-17), luu nhap moi buoc va mo nhap tu Uoc tinh phi (US-16).
export default function CreateOrderScreen({ draftToken: openedDraft, onBack, onGoTab, onOpenOrder }) {
  const [draftToken, setDraftToken] = useState(openedDraft || null);
  const [draft, setDraft] = useState({ data: null, error: null, loading: Boolean(openedDraft) });
  const { data: locationData, refresh: refreshLocations } = useCachedQuery("/pickupLocations");
  const { data: serviceTypes } = useCachedQuery("/public/service-types");
  const { data: areas } = useCachedQuery("/public/service-areas");
  const locations = locationData || [];

  const [form, setForm] = useState(EMPTY_ORDER);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // Mo nhap (neu vao tu Uoc tinh phi) - khach da dang nhap mo nhap thi nhap thuoc ve khach
  useEffect(() => {
    if (!openedDraft) return undefined;
    let cancelled = false;
    apiClient
      .get(`/orderDrafts/${encodeURIComponent(openedDraft)}`)
      .then((res) => !cancelled && setDraft({ data: res.data.data, error: null, loading: false }))
      .catch((err) => !cancelled && setDraft({ data: null, error: err, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [openedDraft]);

  useEffect(() => {
    if (hydrated || !locationData || !serviceTypes || draft.loading) return;
    const restored = fromDraft(draft.data?.payload, locationData);
    const defaultLocation = locationData.find((location) => location.isDefault)?._id || "";
    setForm({
      ...EMPTY_ORDER,
      ...restored,
      pickupLocationId: restored?.pickupLocationId || defaultLocation,
      serviceTypeId: restored?.serviceTypeId || serviceTypes[0]?._id || "",
    });
    setHydrated(true);
  }, [hydrated, locationData, serviceTypes, draft]);

  const location = locations.find((l) => l._id === form.pickupLocationId);

  async function saveDraft(next) {
    try {
      if (draftToken) {
        await apiClient.put(`/orderDrafts/${encodeURIComponent(draftToken)}`, { payload: next });
      } else {
        setDraftToken((await apiClient.post("/orderDrafts", { payload: next })).data.data.draftToken);
      }
    } catch {
      // luu nhap loi khong chan tao don
    }
  }

  async function loadQuote(current) {
    setQuote(null);
    setQuoteError("");
    try {
      const res = await apiClient.post("/orders/estimate-fee", {
        pickup: { province: location.province, district: location.district },
        receiver: current.receiver,
        item: toItemPayload(current.item),
        flags: toFlagsPayload(current.item),
        serviceTypeId: current.serviceTypeId,
      });
      setQuote(res.data.data);
    } catch (err) {
      setQuoteError(errorMessage(err, "Không tính được phí"));
    }
  }

  function next() {
    const problem = stepError(form.step, form, areas || []);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const advanced = { ...form, step: form.step + 1 };
    setForm(advanced);
    saveDraft(advanced);
    if (advanced.step === 4) loadQuote(advanced);
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await apiClient.post("/orders", toOrderPayload(form, draftToken));
      queryCache.invalidate("/orders");
      setCreated(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "Không tạo được đơn"));
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setCreated(null);
    setDraftToken(null);
    setQuote(null);
    setForm({
      ...EMPTY_ORDER,
      pickupLocationId: locations.find((l) => l.isDefault)?._id || "",
      serviceTypeId: serviceTypes?.[0]?._id || "",
    });
  }

  if (created) {
    return (
      <Screen title="Đã tạo đơn" onBack={onBack}>
        <Card testID="order-created">
          <Text style={styles.muted}>Mã vận đơn</Text>
          <Text style={styles.code} testID="order-tracking-code">
            {created.trackingCode}
          </Text>
          <Text style={styles.line}>Trạng thái: chờ bưu cục xác nhận</Text>
          <Text style={styles.line}>Phí vận chuyển: {formatVnd(created.fee.total)}</Text>
          <Button testID="order-new" title="Tạo đơn khác" onPress={startOver} />
          <Button testID="order-view" title="Xem đơn" variant="secondary" onPress={() => onOpenOrder(created._id)} />
          <Button title="Về tài khoản" variant="secondary" onPress={() => onGoTab("account")} />
        </Card>
      </Screen>
    );
  }

  const option = quote?.options?.[0];
  const summary = option ? codSummary(form.cod, option.fee.total) : null;
  const blockedByCod = Boolean(summary && summary.payToShop < 0);

  return (
    <Screen title="Tạo đơn hàng" subtitle={`Bước ${form.step}/4 · ${STEP_TITLES[form.step - 1]}`} onBack={onBack}>
      <View style={styles.steps}>
        {STEP_TITLES.map((title, index) => (
          <View key={title} style={[styles.stepBar, index < form.step && styles.stepBarDone]} />
        ))}
      </View>
      {draft.error ? <Banner tone="warning">Không mở được thông tin đã nhập (có thể đã quá 24 giờ) — nhập lại từ đầu nhé.</Banner> : null}
      {!hydrated ? <Text style={styles.muted}>Đang tải...</Text> : null}

      {hydrated && form.step === 1 ? (
        <>
          {form.estimatedPickup && !form.pickupLocationId ? (
            <Banner tone="info" testID="order-pickup-hint">
              {`Bạn ước tính phí gửi từ ${form.estimatedPickup.district}, ${form.estimatedPickup.province} — chọn hoặc thêm địa điểm lấy hàng ở đó.`}
            </Banner>
          ) : null}
          {locations.length ? (
            <ChoiceGroup
              label="Shipper đến lấy hàng ở đâu?"
              testID="order-pickup"
              options={locations.map((l) => ({
                value: l._id,
                label: l.label,
                hint: `${l.address}, ${l.district}, ${l.province}${l.isDefault ? " · Mặc định" : ""}`,
              }))}
              value={form.pickupLocationId}
              onChange={(value) => update({ pickupLocationId: value })}
            />
          ) : null}
          {adding || locations.length === 0 ? (
            <Card title="Thêm địa điểm lấy hàng">
              <PickupLocationForm
                submitLabel="Lưu và dùng địa điểm này"
                onCancel={locations.length ? () => setAdding(false) : undefined}
                onSaved={(saved) => {
                  setAdding(false);
                  update({ pickupLocationId: saved._id });
                  refreshLocations();
                }}
              />
            </Card>
          ) : (
            <Button testID="order-add-pickup" title="+ Thêm địa điểm khác" variant="secondary" onPress={() => setAdding(true)} disabled={locations.length >= 10} />
          )}
        </>
      ) : null}

      {hydrated && form.step === 2 ? (
        <Card title="Người nhận">
          <TextField testID="rc-name" label="Tên người nhận" value={form.receiver.name} onChangeText={(t) => update({ receiver: { ...form.receiver, name: t } })} autoCapitalize="words" />
          <TextField testID="rc-phone" label="Số điện thoại người nhận" value={form.receiver.phone} onChangeText={(t) => update({ receiver: { ...form.receiver, phone: t } })} keyboardType="phone-pad" />
          <AddressFields idPrefix="rc" value={form.receiver} onChange={(patch) => update({ receiver: { ...form.receiver, ...patch } })} addressLabel="Địa chỉ nhận (số nhà, đường)" />
        </Card>
      ) : null}

      {hydrated && form.step === 3 ? (
        <>
          <Card title="Hàng hóa">
            <TextField testID="it-name" label="Tên hàng hóa" value={form.item.name} onChangeText={(t) => update({ item: { ...form.item, name: t } })} />
            <ParcelFields idPrefix="it" value={form.item} onChange={(patch) => update({ item: { ...form.item, ...patch } })} />
          </Card>
          <ChoiceGroup
            label="Gói dịch vụ"
            testID="order-service"
            options={(serviceTypes || []).map((t) => ({ value: t._id, label: t.name, hint: `Dự kiến ${t.estimatedDays} ngày` }))}
            value={form.serviceTypeId}
            onChange={(value) => update({ serviceTypeId: value })}
          />
          <Card title="Thu hộ và phí vận chuyển">
            <Toggle
              testID="cod-enabled"
              label="Thu hộ tiền hàng (COD)"
              value={form.cod.enabled}
              onChange={(enabled) =>
                update({ cod: { ...form.cod, enabled, feePayer: !enabled && form.cod.feePayer === "DEDUCT_FROM_COD" ? "RECIPIENT_PAID" : form.cod.feePayer } })
              }
            />
            {form.cod.enabled ? (
              <TextField testID="cod-amount" label="Số tiền thu hộ (đ)" help="Lớn hơn 0, tối đa 20.000.000 đ" value={form.cod.amount} onChangeText={(t) => update({ cod: { ...form.cod, amount: t } })} keyboardType="number-pad" />
            ) : null}
            <ChoiceGroup
              label="Ai trả phí vận chuyển?"
              testID="fee-payer"
              options={FEE_PAYERS.map((p) => ({
                ...p,
                disabled: p.value === "DEDUCT_FROM_COD" && !form.cod.enabled,
                hint: p.value === "DEDUCT_FROM_COD" && !form.cod.enabled ? "Cần bật thu hộ" : p.hint,
              }))}
              value={form.cod.feePayer}
              onChange={(value) => update({ cod: { ...form.cod, feePayer: value } })}
            />
            {form.cod.feePayer === "SHOP_PREPAID" ? (
              <ChoiceGroup label="Cách trả trước" testID="prepaid" options={PREPAID_METHODS} value={form.cod.feePaymentMethod} onChange={(value) => update({ cod: { ...form.cod, feePaymentMethod: value } })} />
            ) : null}
          </Card>
        </>
      ) : null}

      {hydrated && form.step === 4 ? (
        <>
          <Card title="Kiểm tra đơn">
            <Info label="Lấy hàng" value={location ? `${location.label} — ${location.district}, ${location.province}` : "—"} />
            <Info label="Giao đến" value={`${form.receiver.name} · ${form.receiver.district}, ${form.receiver.province}`} />
            <Info label="Hàng" value={`${form.item.name} · ${form.item.weightGram} g · ${form.item.length}×${form.item.width}×${form.item.height} cm`} />
            <Info label="Thu hộ" value={form.cod.enabled ? formatVnd(Number(form.cod.amount) || 0) : "Không"} />
          </Card>
          <Banner testID="order-quote-error">{quoteError}</Banner>
          {option ? (
            <Card title="Phí dự kiến" testID="order-quote">
              <Text style={styles.muted}>
                Tuyến {quote.zoneLabel} · tính theo {groupThousands(quote.chargeableWeight)} g
              </Text>
              <FeeBreakdown fee={option.fee} />
              <Info label="Shipper thu của người nhận" value={formatVnd(summary.collectFromReceiver)} />
              {form.cod.enabled ? <Info label="Express trả lại bạn" value={formatVnd(summary.payToShop)} /> : null}
              {blockedByCod ? (
                <Banner testID="order-cod-blocked">Tiền thu hộ nhỏ hơn phí vận chuyển — không khấu trừ được.</Banner>
              ) : null}
            </Card>
          ) : !quoteError ? (
            <Text style={styles.muted}>Đang tính phí...</Text>
          ) : null}
        </>
      ) : null}

      <Banner testID="order-error">{error}</Banner>
      <View style={styles.actions}>
        {form.step > 1 ? (
          <Button title="Quay lại" variant="secondary" onPress={() => { setError(""); update({ step: form.step - 1 }); }} style={styles.action} />
        ) : null}
        {form.step < 4 ? (
          <Button testID="order-next" title="Tiếp tục" onPress={next} disabled={!hydrated} style={styles.action} />
        ) : (
          <Button testID="order-submit" title="Xác nhận tạo đơn" onPress={submit} loading={submitting} disabled={!option || blockedByCod} style={styles.action} />
        )}
      </View>
    </Screen>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: "row", gap: 6 },
  stepBar: { flex: 1, height: 6, borderRadius: radius.sm, backgroundColor: colors.border },
  stepBarDone: { backgroundColor: colors.primary },
  muted: { fontSize: 13, color: colors.muted },
  code: { fontSize: 26, fontWeight: "800", color: colors.primary, letterSpacing: 1 },
  line: { fontSize: 15, color: colors.text },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
  info: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: "right", fontWeight: "600" },
});
