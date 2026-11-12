import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Button from "../components/Button";
import Banner from "../components/Banner";
import AreaFields from "../components/AreaFields";
import ParcelFields from "../components/ParcelFields";
import FeeBreakdown from "../components/FeeBreakdown";
import { apiClient, errorMessage } from "../lib/apiClient";
import { distanceText, formatVnd, groupThousands } from "../lib/format";
import { EMPTY_PARCEL, toFlagsPayload, toItemPayload } from "../lib/orderForm";
import { colors } from "../theme";

const EMPTY_AREA = { province: "", ward: "" };

// Uoc tinh phi cong khai (US-16) - cung luong voi Web Khach hang: "Gui hang" luu nhap
// (draftToken 24 gio) roi moi doi dang nhap / dang ky; tao don dien san du lieu da nhap.
export default function EstimateScreen({ onBack, onShip }) {
  const [pickup, setPickup] = useState(EMPTY_AREA);
  const [receiver, setReceiver] = useState(EMPTY_AREA);
  const [parcel, setParcel] = useState(EMPTY_PARCEL);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const request = () => ({ pickup, receiver, item: toItemPayload(parcel), flags: toFlagsPayload(parcel) });
  const edit = (setter) => (patch) => {
    setter((prev) => ({ ...prev, ...patch }));
    setResult(null);
  };

  async function estimate() {
    setError("");
    setBusy(true);
    try {
      setResult((await apiClient.post("/orders/estimate-fee", request())).data.data);
    } catch (err) {
      setError(errorMessage(err, "Không ước tính được phí"));
    } finally {
      setBusy(false);
    }
  }

  async function ship(option) {
    setError("");
    setBusy(true);
    try {
      const payload = { source: "estimate", ...request(), serviceTypeId: option.serviceTypeId };
      const { draftToken } = (await apiClient.post("/orderDrafts", { payload })).data.data;
      onShip(draftToken);
    } catch (err) {
      setError(errorMessage(err, "Không lưu được thông tin, vui lòng thử lại"));
      setBusy(false);
    }
  }

  return (
    <Screen title="Ước tính phí" subtitle="Không cần đăng nhập" onBack={onBack}>
      <Card title="Gửi từ">
        <AreaFields idPrefix="from" value={pickup} onChange={edit(setPickup)} />
      </Card>
      <Card title="Gửi đến">
        <AreaFields idPrefix="to" value={receiver} onChange={edit(setReceiver)} />
      </Card>
      <Card title="Kiện hàng">
        <ParcelFields idPrefix="est" value={parcel} onChange={edit(setParcel)} />
      </Card>
      <Banner testID="estimate-error">{error}</Banner>
      <Button testID="estimate-submit" title="Tính phí" onPress={estimate} loading={busy && !result} />

      {result ? (
        <>
          <Text style={styles.summary} testID="estimate-summary">
            {result.pickupArea.ward} → {result.receiverArea.ward} · tuyến {result.zoneLabel} · tính theo{" "}
            {groupThousands(result.chargeableWeight)} g
            {result.distanceKm !== null ? ` · ${distanceText(result)}` : ""}
          </Text>
          {result.options.map((option) => (
            <Card
              key={option.code}
              testID={`estimate-option-${option.code}`}
              title={option.name}
              right={<Text style={styles.total}>{option.available === false ? "—" : formatVnd(option.fee.total)}</Text>}
            >
              {option.available === false ? (
                <Text style={styles.muted} testID={`estimate-unavailable-${option.code}`}>
                  {option.reason}
                </Text>
              ) : (
                <>
                  <Text style={styles.muted}>Dự kiến giao trong {option.estimatedDays} ngày</Text>
                  <FeeBreakdown fee={option.fee} />
                </>
              )}
              <View style={option.available === false ? styles.hidden : null}>
                <Button
                  testID={`estimate-ship-${option.code}`}
                  title={`Gửi hàng gói ${option.name}`}
                  onPress={() => ship(option)}
                  disabled={busy}
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, color: colors.muted },
  total: { fontSize: 17, fontWeight: "800", color: colors.primary },
  muted: { fontSize: 13, color: colors.muted },
  hidden: { display: "none" },
});
