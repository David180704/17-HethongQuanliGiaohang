import { ErrorCodes } from "../../core/errors.js";

export function createRouteSchema(body) {
  const { code, name, hubId, maxPickupPerShift, maxDeliveryPerShift } = body;
  if (!code || !name || !hubId || maxPickupPerShift == null || maxDeliveryPerShift == null) {
    throw ErrorCodes.VALIDATION_ERROR("Thieu code/name/hubId/maxPickupPerShift/maxDeliveryPerShift");
  }
  return {
    code,
    name,
    hubId,
    maxPickupPerShift,
    maxDeliveryPerShift,
    isActive: body.isActive !== undefined ? body.isActive : true,
  };
}

const UPDATABLE_FIELDS = ["code", "name", "hubId", "maxPickupPerShift", "maxDeliveryPerShift", "isActive"];

export function updateRouteSchema(body) {
  const sanitized = {};
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) sanitized[field] = body[field];
  }
  return sanitized;
}
