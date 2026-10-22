import { ServiceType } from "../../models/ServiceType.js";
import { ServiceArea } from "../../models/ServiceArea.js";
import { PriceTable } from "../../models/PriceTable.js";

// Du lieu cong khai cho khach vang lai (GUEST): chi doc, chi tra field an toan,
// khong lo field noi bo (routeId, hubId, createdAt...).

export function listServiceTypes() {
  return ServiceType.find({ isActive: true }).select("code name surchargeRate estimatedDays").sort({ surchargeRate: 1 });
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listServiceAreas({ search } = {}) {
  const filter = {};
  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    filter.$or = [{ province: pattern }, { district: pattern }];
  }
  return ServiceArea.find(filter).select("province district wards region").sort({ province: 1, district: 1 });
}

// Bang gia dang hieu luc tai thoi diem `at`: isActive, effectiveFrom <= at,
// effectiveTo trong hoac > at.
export function listActivePriceTables(at = new Date()) {
  return PriceTable.find({
    isActive: true,
    effectiveFrom: { $lte: at },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: at } }],
  })
    .select("serviceTypeId zone weightTiers effectiveFrom effectiveTo")
    .populate("serviceTypeId", "code name surchargeRate")
    .sort({ zone: 1 });
}
