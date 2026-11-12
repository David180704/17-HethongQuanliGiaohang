import { ErrorCodes } from "../../core/errors.js";
import { REGION } from "../../constants/enums.js";
import { checkAddress } from "../adminUnits/adminUnits.js";

// province/ward khong cho sua sau khi tao (coi nhu dinh danh cua khu vuc) -
// muon doi dia ban thi xoa roi tao lai. Chi cho doi tuyen/mien.
const UPDATABLE_FIELDS = ["region", "routeId"];

// Strategy kiem tra du lieu khu vuc phuc vu (US-11). Ham thuan, khong truy van DB:
// xa/phuong phai co that va thuoc dung tinh (danh muc hanh chinh), luu ten chuan;
// rang buoc "mot xa/phuong chi thuoc mot tuyen" nam o ServiceAreaService.
export const serviceAreaValidator = {
  create(body) {
    const { province, ward, region, routeId } = body;
    if (!province || !ward || !region || !routeId) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu province/ward/region/routeId");
    }
    if (!REGION.includes(region)) throw ErrorCodes.VALIDATION_ERROR("region không hợp lệ");
    const checked = checkAddress(province, ward);
    if (!checked.ok) throw ErrorCodes.VALIDATION_ERROR(checked.message);
    return { province: checked.province, ward: checked.ward, region, routeId };
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
