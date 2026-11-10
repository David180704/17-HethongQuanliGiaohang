import { ErrorCodes } from "../../core/errors.js";
import { PICKUP_FAIL_REASON } from "../../constants/enums.js";

// Nhan nguyen nhan khong lay duoc hang (US-28, PB#34) - dung chung API, App Nhan vien, hanh trinh don
export const PICKUP_FAIL_LABELS = {
  SHOP_UNREACHABLE: "Không liên lạc được người gửi",
  NOT_READY: "Hàng chưa sẵn sàng",
  WRONG_ADDRESS: "Sai địa chỉ lấy hàng",
  NOT_AS_DESCRIBED: "Hàng không đúng mô tả / quá khổ",
  SHOP_CANCELLED: "Người gửi hủy gửi hàng",
  OTHER: "Lý do khác",
};

/** Toa do GPS bat buoc (gia lap tren may ao / trinh duyet): so thuc trong mien hop le. */
export function parseLocation(input = {}) {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (input.lat === undefined || input.lng === undefined || input.lat === "" || input.lng === "") {
    throw ErrorCodes.VALIDATION_ERROR("Thiếu tọa độ GPS (lat, lng)");
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw ErrorCodes.VALIDATION_ERROR("Tọa độ GPS không hợp lệ");
  }
  return { lat, lng };
}

/** Xac nhan da lay: ma quet / nhap phai dung ma van don cua don (chong lay nham kien). */
export function parsePickedUp(input = {}, trackingCode) {
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) throw ErrorCodes.VALIDATION_ERROR("Quét hoặc nhập mã vận đơn trên kiện hàng");
  if (code !== trackingCode) throw ErrorCodes.VALIDATION_ERROR(`Mã ${code} không khớp đơn ${trackingCode} — kiểm tra lại kiện hàng`);
  return { location: parseLocation(input) };
}

/** Khong lay duoc: bat buoc chon nguyen nhan; "Ly do khac" bat buoc ghi chu. */
export function parsePickupFailed(input = {}) {
  const reason = String(input.reason || "");
  if (!PICKUP_FAIL_REASON.includes(reason)) throw ErrorCodes.VALIDATION_ERROR("Chọn nguyên nhân không lấy được hàng");
  const note = String(input.note || "").trim();
  if (reason === "OTHER" && note.length < 5) throw ErrorCodes.VALIDATION_ERROR("Lý do khác: ghi rõ nguyên nhân (ít nhất 5 ký tự)");
  return { reason, note: note || null, location: parseLocation(input) };
}
