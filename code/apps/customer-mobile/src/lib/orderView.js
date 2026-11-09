// Hien thi don hang (US-20) - cung noi dung voi apps/web/src/lib/orderView.js. Nhan trang thai lay tu API
// (order.display, statusHistory[].label); file nay chi giu bo loc, mau nhom va nhan phu. Tu dinh dang ngay
// gio (khong dung Intl): Hermes tren mot so may Android khong co du lieu "vi-VN".
import { FEE_PAYERS } from "./orderForm";
import { ZONES } from "./format";
import { colors } from "../theme";

export const GROUP_FILTERS = [
  { code: "", label: "Tất cả" },
  { code: "NOT_RECEIVED", label: "Chưa nhận" },
  { code: "RECEIVED", label: "Đã nhận – Chưa giao" },
  { code: "DELIVERING", label: "Đã nhận – Đang giao" },
  { code: "DELIVERED", label: "Đã giao" },
];

// Loc thoi gian tren dien thoai: chon nhanh khoang ngay (khong can lich chon ngay)
export const RANGE_FILTERS = [
  { code: "", label: "Mọi lúc", days: null },
  { code: "7", label: "7 ngày", days: 7 },
  { code: "30", label: "30 ngày", days: 30 },
];

export const GROUP_COLORS = {
  NOT_RECEIVED: { bg: "#F3F4F6", fg: "#374151" },
  RECEIVED: { bg: colors.warningSoft, fg: colors.warning },
  DELIVERING: { bg: "#DBEAFE", fg: "#1E40AF" },
  DELIVERED: { bg: colors.successSoft, fg: colors.success },
};

const pad = (n) => String(n).padStart(2, "0");

/** Ngay theo gio may "YYYY-MM-DD" (gui len API cho tham so from). */
export function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Tu ngay cua khoang "n ngay gan day" (tinh ca hom nay). */
export function rangeFrom(days, now = new Date()) {
  if (!days) return "";
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  return isoDay(start);
}

/** "14:05 09/11/2026" */
export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const feePayerLabel = (code) => FEE_PAYERS.find((p) => p.value === code)?.label || "—";
export const zoneLabel = (code) => ZONES.find((z) => z.code === code)?.label || code;
export const FEE_PAYMENT_METHOD_LABELS = { QR: "chuyển khoản QR", CASH: "tiền mặt" };
