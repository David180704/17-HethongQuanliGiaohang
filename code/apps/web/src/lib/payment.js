// Thanh toan phi van chuyen qua VNPay (US-44): tao giao dich roi chuyen trinh duyet sang trang VNPay.
// Xong (thanh cong / huy) VNPay dua ve API, API chuyen tiep ve trang chi tiet don kem ?thanhToan=SUCCESS|FAILED.
import { apiClient } from "./apiClient.js";

export const PAYMENT_METHODS = [
  { value: "VNPAY", label: "Thanh toán online VNPay", hint: "Thẻ ATM, thẻ quốc tế, QR ngân hàng — bưu cục duyệt đơn sau khi thanh toán" },
  { value: "CASH", label: "Tiền mặt khi lấy hàng", hint: "Trả shipper khi đến lấy hàng" },
];

/** Don tra truoc qua VNPay ma chua tra -> can thanh toan. */
export const needsVnpay = (order) =>
  order?.cod?.feePayer === "SHOP_PREPAID" && order?.cod?.feePaymentMethod === "VNPAY" && !order?.cod?.feePaid && order?.status !== "CANCELLED";

export async function startVnpay(orderId) {
  const res = await apiClient.post("/payments/vnpay", {
    orderId,
    client: "WEB",
    returnTo: `${window.location.origin}/don-hang/${orderId}`,
  });
  window.location.assign(res.data.data.paymentUrl);
}
