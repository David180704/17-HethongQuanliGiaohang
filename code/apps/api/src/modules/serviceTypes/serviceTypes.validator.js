import { ErrorCodes } from "../../core/errors.js";
import { SERVICE_TYPE_CODE } from "../../constants/enums.js";

const UPDATABLE_FIELDS = ["name", "surchargeRate", "estimatedDays", "isActive"];

// Strategy kiem tra du lieu loai dich vu (US-12): gui thuong / gui nhanh.
export const serviceTypeValidator = {
  create(body) {
    const { code, name, surchargeRate, estimatedDays } = body;
    if (!code || !name || surchargeRate == null || estimatedDays == null) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu code/name/surchargeRate/estimatedDays");
    }
    if (!SERVICE_TYPE_CODE.includes(code)) throw ErrorCodes.VALIDATION_ERROR("code phải là STANDARD hoặc EXPRESS");
    if (surchargeRate < 0) throw ErrorCodes.VALIDATION_ERROR("surchargeRate không được âm");
    if (estimatedDays < 0) throw ErrorCodes.VALIDATION_ERROR("estimatedDays không được âm");
    return {
      code,
      name,
      surchargeRate,
      estimatedDays,
      isActive: body.isActive !== undefined ? body.isActive : true,
    };
  },

  update(body) {
    const sanitized = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) sanitized[field] = body[field];
    }
    if (sanitized.surchargeRate != null && sanitized.surchargeRate < 0) {
      throw ErrorCodes.VALIDATION_ERROR("surchargeRate không được âm");
    }
    if (sanitized.estimatedDays != null && sanitized.estimatedDays < 0) {
      throw ErrorCodes.VALIDATION_ERROR("estimatedDays không được âm");
    }
    return sanitized;
  },
};
