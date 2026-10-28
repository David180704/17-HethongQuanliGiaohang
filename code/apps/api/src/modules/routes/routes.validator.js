import { ErrorCodes } from "../../core/errors.js";

const UPDATABLE_FIELDS = ["code", "name", "hubId", "maxPickupPerShift", "maxDeliveryPerShift", "isActive"];

// Strategy kiem tra du lieu tuyen (US-11).
export const routeValidator = {
  create(body) {
    const { code, name, hubId, maxPickupPerShift, maxDeliveryPerShift } = body;
    if (!code || !name || !hubId || maxPickupPerShift == null || maxDeliveryPerShift == null) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu code/name/hubId/maxPickupPerShift/maxDeliveryPerShift");
    }
    return {
      code,
      name,
      hubId,
      maxPickupPerShift,
      maxDeliveryPerShift,
      isActive: body.isActive !== undefined ? body.isActive : true,
    };
  },

  update(body) {
    const sanitized = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) sanitized[field] = body[field];
    }
    return sanitized;
  },
};
