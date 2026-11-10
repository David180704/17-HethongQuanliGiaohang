import { ErrorCodes } from "../../core/errors.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isFilled = (value) => typeof value === "string" && value.trim() !== "";

/** "2026-11-12" -> 00:00 ngay do theo gio Viet Nam. */
export function parseShiftDate(value) {
  if (typeof value !== "string" || !DAY.test(value)) throw ErrorCodes.VALIDATION_ERROR("Ngày làm việc phải có dạng YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime()) || new Date(date.getTime() + 7 * 3600e3).toISOString().slice(0, 10) !== value) {
    throw ErrorCodes.VALIDATION_ERROR("Ngày làm việc không tồn tại");
  }
  return date;
}

function parseTime(value, label) {
  if (typeof value !== "string" || !TIME.test(value)) throw ErrorCodes.VALIDATION_ERROR(`${label} phải có dạng HH:mm (00:00–23:59)`);
  return value;
}

// Strategy kiem tra ca lam viec (US-23). Ham thuan; tuyen, nguoi giao hang, trung gio kiem o ShiftService.
export const shiftValidator = {
  create(body = {}) {
    if (!isFilled(body.routeId)) throw ErrorCodes.VALIDATION_ERROR("Chọn tuyến");
    if (!isFilled(body.name)) throw ErrorCodes.VALIDATION_ERROR("Nhập tên ca, ví dụ Ca sáng");
    const startTime = parseTime(body.startTime, "Giờ bắt đầu");
    const endTime = parseTime(body.endTime, "Giờ kết thúc");
    if (endTime <= startTime) throw ErrorCodes.VALIDATION_ERROR("Giờ kết thúc phải sau giờ bắt đầu");
    if (body.shipperIds !== undefined && !Array.isArray(body.shipperIds)) {
      throw ErrorCodes.VALIDATION_ERROR("Danh sách người giao hàng không hợp lệ");
    }
    return {
      routeId: body.routeId,
      name: body.name.trim(),
      shiftDate: parseShiftDate(body.shiftDate),
      startTime,
      endTime,
      shipperIds: [...new Set((body.shipperIds || []).map(String))],
    };
  },
  update(body = {}) {
    return this.create(body);
  },
};
