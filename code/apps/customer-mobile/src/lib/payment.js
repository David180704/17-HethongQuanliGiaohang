// Thanh toan phi van chuyen qua VNPay (US-44) - cung luat voi Web Khach hang (apps/web/src/lib/payment.js).
//   Android/iOS: mo trang VNPay trong trinh duyet cua app; VNPay xong -> API chuyen ve deep link
//                edmskh://thanh-toan (Expo Go khi dev: exp://.../--/thanh-toan) -> trinh duyet tu dong, app doc ket qua.
//   Ban web: chuyen ca trang sang VNPay, xong quay ve <dia chi app>/thanh-toan?... -> AppNavigator mo lai don.
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { apiClient } from "./apiClient";

/** Don tra truoc qua VNPay ma chua tra -> can thanh toan. */
export const needsVnpay = (order) =>
  order?.cod?.feePayer === "SHOP_PREPAID" && order?.cod?.feePaymentMethod === "VNPAY" && !order?.cod?.feePaid && order?.status !== "CANCELLED";

/** Doc ket qua tu dia chi VNPay tra ve: { orderId, status: SUCCESS | FAILED | ... } hoac null. */
export function parsePaymentReturn(url) {
  if (!url) return null;
  const { path, queryParams } = Linking.parse(url);
  if (!queryParams?.thanhToan || !String(path || "").includes("thanh-toan")) return null;
  return { orderId: queryParams.orderId || null, status: String(queryParams.thanhToan) };
}

/**
 * Mo trang thanh toan VNPay. Tra ve ket qua (ban di dong) hoac null (nguoi dung dong trinh duyet;
 * ban web thi trang chuyen di nen khong tra ve).
 */
export async function payWithVnpay(orderId) {
  const returnTo = Linking.createURL("thanh-toan", { queryParams: { orderId } });
  const res = await apiClient.post("/payments/vnpay", { orderId, client: Platform.OS === "web" ? "WEB" : "MOBILE", returnTo });
  const { paymentUrl } = res.data.data;
  if (Platform.OS === "web") {
    window.location.assign(paymentUrl);
    return null;
  }
  const result = await WebBrowser.openAuthSessionAsync(paymentUrl, returnTo);
  return result.type === "success" ? parsePaymentReturn(result.url) : null;
}
