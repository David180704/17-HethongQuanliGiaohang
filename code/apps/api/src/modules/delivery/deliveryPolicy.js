// Luat giao hang (de 02: giao thanh cong / that bai, giao lai, hoan hang; US-32, US-33, US-36, US-37).
// Ham thuan, khong DB - DeliveryService, App Nhan vien va test dung chung.
import { ErrorCodes } from "../../core/errors.js";
import { DELIVERY_FAIL_REASON, COD_METHOD } from "../../constants/enums.js";
import { parseLocation } from "../assignments/pickupOutcome.js";

export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 3;

export const DELIVERY_FAIL_LABELS = {
  RECIPIENT_UNREACHABLE: "Không liên hệ được người nhận",
  RESCHEDULE_REQUESTED: "Người nhận hẹn giao lại",
  REFUSED: "Người nhận từ chối nhận hàng",
  WRONG_ADDRESS: "Sai địa chỉ giao hàng",
  RECIPIENT_ABSENT: "Người nhận vắng nhà",
  OTHER: "Lý do khác",
};

export const COD_METHOD_LABELS = { CASH: "Tiền mặt", TRANSFER: "Chuyển khoản" };

/**
 * So tien shipper phai thu cua nguoi nhan: tien thu ho (neu bat) + phi van chuyen neu nguoi nhan tra
 * (giong codSummary o Web / App Khach hang).
 */
export function amountToCollect(order) {
  const cod = order.cod?.enabled ? Number(order.cod.amount) || 0 : 0;
  const fee = order.cod?.feePayer === "RECIPIENT_PAID" ? Number(order.fee?.total) || 0 : 0;
  return { cod, fee, total: cod + fee };
}

/**
 * Sau mot lan giao that bai (attempts = so lan da that bai, tinh ca lan nay):
 *   - nguoi nhan tu choi -> hoan hang ngay;
 *   - da that bai du so lan cho phep -> hoan hang;
 *   - con lai -> cho giao lai.
 */
export function afterFailedDelivery({ reason, attempts, maxAttempts = DEFAULT_MAX_DELIVERY_ATTEMPTS }) {
  if (reason === "REFUSED") return { next: "RETURNING", why: "Người nhận từ chối nhận hàng" };
  if (attempts >= maxAttempts) return { next: "RETURNING", why: `Đã giao không thành công ${attempts}/${maxAttempts} lần` };
  return { next: "RESCHEDULED", why: `Giao lại lần ${attempts + 1}/${maxAttempts}` };
}

/** Quet / nhap ma van don tren kien truoc khi mang di giao (chong cam nham kien). */
export function parseScan(input = {}, trackingCode) {
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) throw ErrorCodes.VALIDATION_ERROR("Quét hoặc nhập mã vận đơn trên kiện hàng");
  if (code !== trackingCode) throw ErrorCodes.VALIDATION_ERROR(`Mã ${code} không khớp đơn ${trackingCode} — kiểm tra lại kiện hàng`);
  return { location: parseLocation(input) };
}

/**
 * Giao thanh cong (US-32, US-33): co thu tien thi so tien thu phai dung so phai thu va chon hinh thuc;
 * chuyen khoan phai co ma giao dich.
 */
export function parseDelivered(input = {}, order) {
  const location = parseLocation(input);
  const expected = amountToCollect(order).total;
  if (expected === 0) return { location, collected: null };
  const amount = Number(input.collectedAmount);
  if (!Number.isFinite(amount) || amount !== expected) {
    throw ErrorCodes.VALIDATION_ERROR(`Phải thu đủ ${expected.toLocaleString("vi-VN")} đ của người nhận (nhập đúng số tiền đã thu)`);
  }
  const method = String(input.method || "");
  if (!COD_METHOD.includes(method)) throw ErrorCodes.VALIDATION_ERROR("Chọn hình thức thu tiền: tiền mặt hoặc chuyển khoản");
  const txnRef = String(input.txnRef || "").trim();
  if (method === "TRANSFER" && txnRef.length < 4) throw ErrorCodes.VALIDATION_ERROR("Chuyển khoản: nhập mã giao dịch (ít nhất 4 ký tự)");
  return { location, collected: { amount, method, txnRef: method === "TRANSFER" ? txnRef : null } };
}

/** Giao that bai (US-32, PB#40): bat buoc chon nguyen nhan; "Ly do khac" bat buoc ghi chu. */
export function parseDeliveryFailed(input = {}) {
  const reason = String(input.reason || "");
  if (!DELIVERY_FAIL_REASON.includes(reason)) throw ErrorCodes.VALIDATION_ERROR("Chọn nguyên nhân giao không thành công");
  const note = String(input.note || "").trim();
  if (reason === "OTHER" && note.length < 5) throw ErrorCodes.VALIDATION_ERROR("Lý do khác: ghi rõ nguyên nhân (ít nhất 5 ký tự)");
  return { reason, note: note || null, location: parseLocation(input) };
}

/** So lan giao toi da (admin doi, US-36): so nguyen 1-10. */
export function parsePolicy(input = {}) {
  const value = Number(input.maxDeliveryAttempts);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw ErrorCodes.VALIDATION_ERROR("Số lần giao tối đa phải là số nguyên từ 1 đến 10");
  }
  return { maxDeliveryAttempts: value };
}
