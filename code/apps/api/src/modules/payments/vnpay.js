// Cong thanh toan VNPay (US-44) - ham thuan, khong doc CSDL. Theo tai lieu tich hop VNPay phien ban 2.1.0:
//   - Tham so gui di sap xep theo ten, ma hoa kieu form (khoang trang thanh dau +), noi bang "&"
//   - vnp_SecureHash = HMAC-SHA512(chuoi tren, hash secret) dang hex
//   - So tien nhan 100 (VNPay khong dung so le, 10.000 d gui 1000000)
//   - Ngay gio dinh dang yyyyMMddHHmmss theo gio Viet Nam (GMT+7)
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export const VNPAY_VERSION = "2.1.0";

// Ma VNPay tra ve cho IPN (VNPay doc RspCode de biet EDMS da nhan ket qua chua)
export const IPN_RESPONSE = {
  OK: { RspCode: "00", Message: "Confirm Success" },
  NOT_FOUND: { RspCode: "01", Message: "Order not found" },
  ALREADY_CONFIRMED: { RspCode: "02", Message: "Order already confirmed" },
  INVALID_AMOUNT: { RspCode: "04", Message: "Invalid amount" },
  INVALID_SIGNATURE: { RspCode: "97", Message: "Invalid signature" },
  UNKNOWN: { RspCode: "99", Message: "Unknown error" },
};

const encode = (value) => encodeURIComponent(value).replace(/%20/g, "+");

/** Chuoi du lieu ky: tham so co gia tri, sap xep theo ten, ma hoa kieu form. */
export function signData(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort()
    .map((key) => `${encode(key)}=${encode(String(params[key]))}`)
    .join("&");
}

export function sign(params, secret) {
  return createHmac("sha512", secret).update(Buffer.from(signData(params), "utf-8")).digest("hex");
}

/** Gio Viet Nam (GMT+7) dang yyyyMMddHHmmss, khong phu thuoc mui gio cua may chu. */
export function vnpDate(date) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const two = (n) => String(n).padStart(2, "0");
  return (
    `${vn.getUTCFullYear()}${two(vn.getUTCMonth() + 1)}${two(vn.getUTCDate())}` +
    `${two(vn.getUTCHours())}${two(vn.getUTCMinutes())}${two(vn.getUTCSeconds())}`
  );
}

/** IP gui VNPay: bo tien to IPv6-mapped; ::1 (localhost) doi thanh 127.0.0.1. */
export function clientIp(ip) {
  if (!ip || ip === "::1") return "127.0.0.1";
  return ip.replace(/^::ffff:/, "");
}

/** Duong dan chuyen nguoi dung sang trang thanh toan VNPay. */
export function buildPaymentUrl({ payUrl, tmnCode, secret, amount, txnRef, orderInfo, returnUrl, ipAddr, createdAt, expiresAt }) {
  const params = {
    vnp_Version: VNPAY_VERSION,
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Amount: Math.round(amount) * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: clientIp(ipAddr),
    vnp_CreateDate: vnpDate(createdAt),
    vnp_ExpireDate: vnpDate(expiresAt),
  };
  return `${payUrl}?${signData(params)}&vnp_SecureHash=${sign(params, secret)}`;
}

/** Kiem chu ky VNPay gui ve (IPN, trang return): chi lay tham so vnp_, bo chinh chu ky ra truoc khi ky lai. */
export function verifySignature(query, secret) {
  const received = typeof query?.vnp_SecureHash === "string" ? query.vnp_SecureHash.toLowerCase() : "";
  const params = {};
  for (const [key, value] of Object.entries(query || {})) {
    if (key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") params[key] = value;
  }
  const expected = sign(params, secret);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/** VNPay bao thanh cong khi ca ma phan hoi lan trang thai giao dich deu la 00. */
export const isSuccess = (query) => query.vnp_ResponseCode === "00" && query.vnp_TransactionStatus === "00";
