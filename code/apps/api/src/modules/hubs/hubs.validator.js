import { ErrorCodes } from "../../core/errors.js";
import { HUB_TYPE } from "../../constants/enums.js";

// code khong sua sau khi tao (in tren nhan, bao cao). Doi dia ban (province/district)
// thi HubService xac dinh lai khu vuc phuc vu.
const UPDATABLE_FIELDS = ["name", "type", "parentHubId", "address", "province", "district", "location", "isActive"];
const REQUIRED_TEXT = ["name", "province", "district"];

const isFilled = (value) => typeof value === "string" && value.trim() !== "";
const trimmed = (value) => (typeof value === "string" ? value.trim() : value);

function assertType(type) {
  if (!HUB_TYPE.includes(type)) throw ErrorCodes.VALIDATION_ERROR("type phải là HUB (điểm tập kết) hoặc POST_OFFICE (bưu cục)");
}

// Strategy kiem tra du lieu diem tap ket / buu cuc (US-14). Ham thuan, khong DB:
// rang buoc can tra cuu (cap tren, khu vuc phuc vu, con dang dung) o HubService.
export const hubValidator = {
  create(body) {
    const { code, name, type, province, district } = body;
    if (![code, name, type, province, district].every(isFilled)) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu code/name/type/province/district");
    }
    assertType(type);
    const sanitized = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      type,
      parentHubId: body.parentHubId || null,
      province: province.trim(),
      district: district.trim(),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };
    if (isFilled(body.address)) sanitized.address = body.address.trim();
    if (body.location) sanitized.location = body.location;
    return sanitized;
  },

  update(body) {
    const sanitized = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) sanitized[field] = trimmed(body[field]);
    }
    if (sanitized.type !== undefined) assertType(sanitized.type);
    for (const field of REQUIRED_TEXT) {
      if (sanitized[field] !== undefined && !isFilled(sanitized[field])) {
        throw ErrorCodes.VALIDATION_ERROR(`${field} không được để trống`);
      }
    }
    if (sanitized.parentHubId === "") sanitized.parentHubId = null;
    return sanitized;
  },
};
