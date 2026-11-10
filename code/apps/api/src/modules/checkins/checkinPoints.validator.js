import { ErrorCodes } from "../../core/errors.js";

const UPDATABLE_FIELDS = ["code", "name", "address", "lat", "lng", "radiusM", "hubId", "isActive"];

const number = (value, field, min, max) => {
  const n = Number(value);
  if (value === "" || value === null || !Number.isFinite(n) || n < min || n > max) {
    throw ErrorCodes.VALIDATION_ERROR(`${field} phải là số từ ${min} đến ${max}`);
  }
  return n;
};

function normalize(data) {
  const out = { ...data };
  if (out.code !== undefined) out.code = String(out.code).trim().toUpperCase();
  if (out.lat !== undefined) out.lat = number(out.lat, "Vĩ độ (lat)", -90, 90);
  if (out.lng !== undefined) out.lng = number(out.lng, "Kinh độ (lng)", -180, 180);
  if (out.radiusM !== undefined) out.radiusM = number(out.radiusM, "Bán kính (m)", 20, 2000);
  if (out.hubId === "") out.hubId = null;
  return out;
}

// Strategy kiem tra diem check-in (US-29): toa do hop le, ban kinh mac dinh 150 m.
export const checkinPointValidator = {
  create(body) {
    if (!body.code || !body.name || body.lat === undefined || body.lng === undefined) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu mã, tên hoặc tọa độ điểm check-in");
    }
    return normalize({
      code: body.code,
      name: body.name,
      address: body.address || "",
      lat: body.lat,
      lng: body.lng,
      radiusM: body.radiusM ?? 150,
      hubId: body.hubId || null,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });
  },

  update(body) {
    const sanitized = {};
    for (const field of UPDATABLE_FIELDS) if (body[field] !== undefined) sanitized[field] = body[field];
    return normalize(sanitized);
  },
};
