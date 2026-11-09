// Hien thi don hang (US-20). Nhan trang thai lay tu API (order.display, statusHistory[].label) - mot nguon
// voi App Khach hang va tra cuu cong khai; file nay chi giu bo loc nhom, mau va cac nhan phu.
import { FEE_PAYERS, PACKING_TYPES } from "./orderForm.js";
import { ZONES } from "./format.js";

export const GROUP_FILTERS = [
  { code: "", label: "Tất cả" },
  { code: "NOT_RECEIVED", label: "Chưa nhận" },
  { code: "RECEIVED", label: "Đã nhận – Chưa giao" },
  { code: "DELIVERING", label: "Đã nhận – Đang giao" },
  { code: "DELIVERED", label: "Đã giao" },
];

export const GROUP_BADGE_CLASS = {
  NOT_RECEIVED: "bg-gray-100 text-gray-700 ring-gray-200",
  RECEIVED: "bg-amber-50 text-amber-800 ring-amber-200",
  DELIVERING: "bg-blue-50 text-blue-800 ring-blue-200",
  DELIVERED: "bg-green-50 text-green-800 ring-green-200",
};

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const feePayerLabel = (code) => FEE_PAYERS.find((p) => p.value === code)?.label || "—";
export const packingLabel = (code) => PACKING_TYPES.find((p) => p.value === code)?.label || code;
export const zoneLabel = (code) => ZONES.find((z) => z.code === code)?.label || code;
export const FEE_PAYMENT_METHOD_LABELS = { QR: "chuyển khoản QR", CASH: "tiền mặt" };
