import { ErrorCodes } from "../../core/errors.js";
import { normalizeVnPhone } from "../../core/phone.js";

const TEXT_FIELDS = ["label", "contactName", "address", "province", "ward"];
const LABELS = {
  label: "tên gợi nhớ",
  contactName: "người liên hệ",
  contactPhone: "số điện thoại liên hệ",
  address: "địa chỉ",
  province: "tỉnh/thành phố",
  ward: "xã/phường",
};

const isFilled = (value) => typeof value === "string" && value.trim() !== "";

function phone(value) {
  const normalized = normalizeVnPhone(value);
  if (!normalized) throw ErrorCodes.VALIDATION_ERROR("Số điện thoại liên hệ phải gồm 10–11 chữ số, bắt đầu bằng 0");
  return normalized;
}

// Strategy kiem tra dia diem lay hang (US-15). Ham thuan, khong DB. customerId,
// serviceAreaId, isActive do server dat - khong nhan tu body.
export const pickupLocationValidator = {
  create(body) {
    const missing = [...TEXT_FIELDS, "contactPhone"].filter((field) => !isFilled(body[field]));
    if (missing.length) throw ErrorCodes.VALIDATION_ERROR(`Thiếu ${missing.map((field) => LABELS[field]).join(", ")}`);
    const sanitized = Object.fromEntries(TEXT_FIELDS.map((field) => [field, body[field].trim()]));
    sanitized.contactPhone = phone(body.contactPhone);
    sanitized.isDefault = body.isDefault === true;
    return sanitized;
  },

  update(body) {
    const sanitized = {};
    for (const field of TEXT_FIELDS) {
      if (body[field] === undefined) continue;
      if (!isFilled(body[field])) throw ErrorCodes.VALIDATION_ERROR(`Không được để trống ${LABELS[field]}`);
      sanitized[field] = body[field].trim();
    }
    if (body.contactPhone !== undefined) sanitized.contactPhone = phone(body.contactPhone);
    if (body.isDefault !== undefined) sanitized.isDefault = body.isDefault === true;
    return sanitized;
  },
};
