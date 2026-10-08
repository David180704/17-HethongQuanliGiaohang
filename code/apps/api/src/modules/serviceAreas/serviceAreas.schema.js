import { ErrorCodes } from "../../core/errors.js";
import { REGION } from "../../constants/enums.js";
import { ServiceArea } from "../../models/ServiceArea.js";

export async function createServiceAreaSchema(body) {
  const { province, district, region, routeId } = body;
  if (!province || !district || !region || !routeId) {
    throw ErrorCodes.VALIDATION_ERROR("Thieu province/district/region/routeId");
  }
  if (!REGION.includes(region)) throw ErrorCodes.VALIDATION_ERROR("region khong hop le");

  // Chan som bang message ro nghia, thay vi de roi vao loi trung khoa chung
  // (unique index tren province+district la tuyen phong ngu cuoi).
  const existing = await ServiceArea.findOne({ province, district });
  if (existing) throw ErrorCodes.CONFLICT("Quan/huyen nay da thuoc mot tuyen khac");

  return {
    province,
    district,
    wards: body.wards || [],
    region,
    routeId,
  };
}

// province/district khong cho sua sau khi tao (coi nhu dinh danh cua khu vuc) -
// de chinh dia ban, xoa roi tao lai. Chi cho doi tuyen/mien/danh sach phuong xa.
const UPDATABLE_FIELDS = ["region", "routeId", "wards"];

export function updateServiceAreaSchema(body) {
  const sanitized = {};
  for (const field of UPDATABLE_FIELDS) {
    if (body[field] !== undefined) sanitized[field] = body[field];
  }
  if (sanitized.region && !REGION.includes(sanitized.region)) {
    throw ErrorCodes.VALIDATION_ERROR("region khong hop le");
  }
  return sanitized;
}
