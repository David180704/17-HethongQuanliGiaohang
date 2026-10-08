import { ErrorCodes } from "../../core/errors.js";
import { SERVICE_TYPE_CODE } from "../../constants/enums.js";

export function createServiceTypeSchema(body) {
  const { code, name, surchargeRate, estimatedDays } = body;
  if (!code || !name || surchargeRate == null || estimatedDays == null) {
    throw ErrorCodes.VALIDATION_ERROR("Thieu code/name/surchargeRate/estimatedDays");
  }
  if (!SERVICE_TYPE_CODE.includes(code)) throw ErrorCodes.VALIDATION_ERROR("code phai la STANDARD hoac EXPRESS");
  if (surchargeRate < 0) throw ErrorCodes.VALIDATION_ERROR("surchargeRate khong duoc am");
  if (estimatedDays < 0) throw ErrorCodes.VALIDATION_ERROR("estimatedDays khong duoc am");

  return {
    code,
    name,
    surchargeRate,
    estimatedDays,
    isActive: body.isActive !== undefined ? body.isActive : true,
  };
}

const UPDATABLE_FIELDS = ["name", "surchargeRate", "estimatedDays", "isActive"];

export function updateServiceTypeSchema(body) {
  const sanitized = {};
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) sanitized[field] = body[field];
  }
  if (sanitized.surchargeRate != null && sanitized.surchargeRate < 0) {
    throw ErrorCodes.VALIDATION_ERROR("surchargeRate khong duoc am");
  }
  if (sanitized.estimatedDays != null && sanitized.estimatedDays < 0) {
    throw ErrorCodes.VALIDATION_ERROR("estimatedDays khong duoc am");
  }
  return sanitized;
}
