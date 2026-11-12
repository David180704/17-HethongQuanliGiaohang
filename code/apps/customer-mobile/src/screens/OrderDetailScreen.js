import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "../components/Button";
import IncidentCard from "../components/IncidentCard";
import Screen from "../components/Screen";
import Card from "../components/Card";
import Banner from "../components/Banner";
import FeeBreakdown from "../components/FeeBreakdown";
import StatusBadge from "../components/StatusBadge";
import UpdatedAt from "../components/UpdatedAt";
import { useCachedQuery } from "../lib/useCachedQuery";
import { apiClient, errorMessage } from "../lib/apiClient";
import { queryCache } from "../lib/queryCache";
import { formatVnd } from "../lib/format";
import { FEE_PAYMENT_METHOD_LABELS, feePayerLabel, formatDateTime, zoneLabel } from "../lib/orderView";
import { colors } from "../theme";

// US-20: chi tiet don kem toan bo hanh trinh (moi nhat o tren), phi da khoa, thu ho.
export default function OrderDetailScreen({ orderId, onBack }) {
  const { data: order, error, updatedAt, refresh } = useCachedQuery(`/orders/${orderId}`);
  const [returnState, setReturnState] = useState({ busy: false, message: "", error: "" });

  // US-37: tai xe da tra hang hoan -> nguoi gui xac nhan da nhan lai
  async function confirmReturn() {
    setReturnState({ busy: true, message: "", error: "" });
    try {
      await apiClient.post(`/deliveries/${orderId}/confirm-return`);
      queryCache.invalidate("/orders");
      setReturnState({ busy: false, message: "Đã xác nhận nhận lại hàng", error: "" });
      refresh();
    } catch (err) {
      setReturnState({ busy: false, message: "", error: errorMessage(err) });
    }
  }

  if (error) {
    const notFound = error?.response?.status === 404;
    return (
      <Screen title="Chi tiết đơn" onBack={onBack}>
        <Banner testID="order-detail-error">
          {notFound ? "Không tìm thấy đơn hàng (đơn không tồn tại hoặc không thuộc tài khoản này)." : errorMessage(error)}
        </Banner>
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen title="Chi tiết đơn" onBack={onBack}>
        <Text style={styles.muted}>Đang tải...</Text>
      </Screen>
    );
  }

  const journey = [...order.statusHistory].reverse();
  const flags = [order.flags?.fragile && "Dễ vỡ", order.flags?.highValue && "Giá trị cao", order.flags?.isVehicle && "Hàng là xe"].filter(Boolean);

  return (
    <Screen title={order.trackingCode} subtitle={`Tạo ${formatDateTime(order.createdAt)}`} onBack={onBack}>
      <Card title="Trạng thái" right={<StatusBadge display={order.display} testID="order-detail-status" />}>
        <UpdatedAt at={updatedAt} onRefresh={refresh} />
      </Card>

      {order.deliveryAttempts > 0 || order.status === "RETURNING" || order.status === "RETURNED" ? (
        <Card title="Giao hàng và hoàn hàng" testID="order-return">
          {order.deliveryAttempts > 0 ? <Text style={styles.small}>Đã giao không thành công {order.deliveryAttempts} lần.</Text> : null}
          {order.returnReason ? <Text style={styles.small}>Hoàn về người gửi: {order.returnReason}.</Text> : null}
          {order.status === "RETURNING" && !order.returnHandedAt ? (
            <Text style={styles.small}>Express đang đưa hàng hoàn về địa điểm lấy hàng của bạn.</Text>
          ) : null}
          {order.status === "RETURNING" && order.returnHandedAt ? (
            <>
              <Text style={styles.small}>Người giao hàng đã trả hàng lúc {formatDateTime(order.returnHandedAt)}.</Text>
              <Button testID="order-confirm-return" title="Đã nhận lại hàng" onPress={confirmReturn} loading={returnState.busy} />
            </>
          ) : null}
          <Banner tone="success">{returnState.message}</Banner>
          <Banner>{returnState.error}</Banner>
        </Card>
      ) : null}

      <Card title="Hành trình" testID="order-journey">
        {journey.map((step, index) => (
          <View key={`${step.status}-${step.at}`} style={styles.step} testID={`journey-${index}`}>
            <View style={[styles.dot, index === 0 && styles.dotNow]} />
            <View style={styles.stepText}>
              <Text style={[styles.stepLabel, index === 0 && styles.stepLabelNow]}>{step.label}</Text>
              <Text style={styles.small}>{formatDateTime(step.at)}</Text>
              {step.note ? <Text style={styles.small}>{step.note}</Text> : null}
            </View>
          </View>
        ))}
      </Card>

      <Card title="Người nhận">
        <Text style={styles.strong}>
          {order.receiver.name} · {order.receiver.phone}
        </Text>
        <Text style={styles.muted}>
          {order.receiver.address}, {order.receiver.ward}, {order.receiver.province}
        </Text>
        <Text style={styles.small}>
          Người gửi: {order.customerName} · lấy hàng tại {order.pickupWard}
        </Text>
      </Card>

      <Card title="Hàng hóa và dịch vụ">
        <Row label="Hàng" value={order.item.name} />
        <Row label="Khối lượng, kích thước" value={`${order.item.weightGram} g · ${order.item.length}×${order.item.width}×${order.item.height} cm`} />
        <Row label="Khối lượng tính phí" value={`${order.chargeableWeight} g`} />
        <Row label="Dịch vụ, vùng" value={`${order.serviceName} · ${zoneLabel(order.zone)}`} />
        {order.item.declaredValue > 0 ? <Row label="Giá trị khai báo" value={formatVnd(order.item.declaredValue)} /> : null}
        {flags.length ? <Row label="Đặc tính" value={flags.join(", ")} /> : null}
      </Card>

      <Card title="Phí và thu hộ" testID="order-fee">
        <FeeBreakdown fee={order.fee} />
        <Text style={styles.small} testID="order-fee-lock">
          {order.fee.lockedAt
            ? `Phí đã khóa lúc ${formatDateTime(order.fee.lockedAt)} — bảng giá đổi sau này không ảnh hưởng.`
            : "Phí tạm tính theo bảng giá lúc tạo đơn; khóa khi bưu cục xác nhận."}
        </Text>
        <Row
          label="Người trả phí"
          value={`${feePayerLabel(order.cod?.feePayer)}${order.cod?.feePaymentMethod ? ` (${FEE_PAYMENT_METHOD_LABELS[order.cod.feePaymentMethod]})` : ""}`}
        />
        <Row label="Thu hộ" value={order.cod?.enabled ? formatVnd(order.cod.amount) : "Không thu hộ"} />
      </Card>
      <IncidentCard orderId={orderId} onChanged={refresh} />
    </Screen>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  small: { fontSize: 12, color: colors.muted },
  strong: { fontSize: 14, fontWeight: "700", color: colors.text },
  step: { flexDirection: "row", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, marginTop: 4 },
  dotNow: { backgroundColor: colors.primary },
  stepText: { flex: 1, gap: 1 },
  stepLabel: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  stepLabelNow: { color: colors.text, fontWeight: "800" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, fontWeight: "600", color: colors.text, flexShrink: 1, textAlign: "right" },
});
