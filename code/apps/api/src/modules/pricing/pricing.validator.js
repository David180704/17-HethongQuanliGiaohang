import { ErrorCodes } from "../../core/errors.js";
import { PACKING_TYPE } from "../../constants/enums.js";

// Gioi han hop ly cho mot kien (xe may ~100 kg van lot): tranh so am, so 0 lam
// khoi luong quy doi bang 0, hoac so qua lon do go nham.
export const ITEM_LIMITS = { maxWeightGram: 500_000, maxSideCm: 300, maxDeclaredValue: 100_000_000 };

const isFilled = (value) => typeof value === "string" && value.trim() !== "";
const toNumber = (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value);

function positive(value, label, max) {
  const number = toNumber(value);
  if (typeof number !== "number" || !Number.isFinite(number) || number <= 0) {
    throw ErrorCodes.VALIDATION_ERROR(`${label} phải là số lớn hơn 0`);
  }
  if (number > max) throw ErrorCodes.VALIDATION_ERROR(`${label} tối đa ${max.toLocaleString("vi-VN")}`);
  return number;
}

/** Tinh/thanh + quan/huyen bat buoc (khop vung phuc vu o PricingService). */
export function parseArea(area, side) {
  if (!area || !isFilled(area.province) || !isFilled(area.district)) {
    throw ErrorCodes.VALIDATION_ERROR(`Thiếu tỉnh/thành hoặc quận/huyện nơi ${side}`);
  }
  return { province: area.province.trim(), district: area.district.trim() };
}

/** Kien hang: gram va cm. requireName: tao don can ten hang, uoc tinh phi thi khong. */
export function parseItem(item, { requireName = false } = {}) {
  if (!item || typeof item !== "object") throw ErrorCodes.VALIDATION_ERROR("Thiếu thông tin kiện hàng");
  const parsed = {
    // Lam tron len gram nguyen: 0,4 g van tinh 1 g
    weightGram: Math.ceil(positive(item.weightGram, "Khối lượng (g)", ITEM_LIMITS.maxWeightGram)),
    length: positive(item.length, "Chiều dài (cm)", ITEM_LIMITS.maxSideCm),
    width: positive(item.width, "Chiều rộng (cm)", ITEM_LIMITS.maxSideCm),
    height: positive(item.height, "Chiều cao (cm)", ITEM_LIMITS.maxSideCm),
    declaredValue: 0,
  };
  if (item.declaredValue !== undefined && item.declaredValue !== null && item.declaredValue !== "") {
    const value = toNumber(item.declaredValue);
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > ITEM_LIMITS.maxDeclaredValue) {
      throw ErrorCodes.VALIDATION_ERROR("Giá trị khai báo phải từ 0 đến 100.000.000 đ");
    }
    parsed.declaredValue = Math.round(value);
  }
  if (requireName) {
    if (!isFilled(item.name)) throw ErrorCodes.VALIDATION_ERROR("Thiếu tên hàng hóa");
    parsed.name = item.name.trim();
    parsed.packingType = PACKING_TYPE.includes(item.packingType) ? item.packingType : "BOX";
    if (isFilled(item.note)) parsed.note = item.note.trim();
  }
  return parsed;
}

export function parseFlags(flags = {}) {
  const source = flags && typeof flags === "object" ? flags : {};
  return { fragile: source.fragile === true, highValue: source.highValue === true, isVehicle: source.isVehicle === true };
}

/** POST /orders/estimate-fee (US-16): noi gui, noi nhan, kien hang; serviceTypeId tuy chon. */
export function estimateValidator(body = {}) {
  return {
    pickup: parseArea(body.pickup, "gửi"),
    receiver: parseArea(body.receiver, "nhận"),
    item: parseItem(body.item),
    flags: parseFlags(body.flags),
    serviceTypeId: isFilled(body.serviceTypeId) ? body.serviceTypeId : null,
  };
}
