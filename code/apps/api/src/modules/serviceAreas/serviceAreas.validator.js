import { ErrorCodes } from "../../core/errors.js";
import { REGION } from "../../constants/enums.js";

// province/district khong cho sua sau khi tao (coi nhu dinh danh cua khu vuc) -
// muon doi dia ban thi xoa roi tao lai. Chi cho doi tuyen/mien/danh sach phuong xa.
const UPDATABLE_FIELDS = ["region", "routeId", "wards"];

// Strategy kiem tra du lieu khu vuc phuc vu (US-11). Ham thuan, khong truy van DB:
// rang buoc "mot quan chi thuoc mot tuyen" nam o ServiceAreaService.
export const serviceAreaValidator = {
  create(body) {
    const { province, district, region, routeId } = body;
    if (!province || !district || !region || !routeId) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu province/district/region/routeId");
    }
    if (!REGION.includes(region)) throw ErrorCodes.VALIDATION_ERROR("region không hợp lệ");
    return { province, district, wards: body.wards || [], region, routeId };
  },

  update(body) {
    const sanitized = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) sanitized[field] = body[field];
    }
    if (sanitized.region && !REGION.includes(sanitized.region)) {
      throw ErrorCodes.VALIDATION_ERROR("region không hợp lệ");
    }
    return sanitized;
  },
};
