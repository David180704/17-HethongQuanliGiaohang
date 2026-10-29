import { ErrorCodes } from "../../core/errors.js";
import { ZONE } from "../../constants/enums.js";

// Quy uoc bac khoi luong: mot kien thuoc bac khi fromGram <= weight < toGram (nua mo ben
// phai). Bac cuoi dung toGram rat lon de coi nhu khong gioi han.
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Kiem tra va chuan hoa danh sach bac khoi luong cua MOT bang gia (US-13):
 * bac dau bat dau tu 0 g, cac bac noi tiep nhau - khong chong lan, khong ho khoang trong.
 * Tra ve mang da sap xep theo fromGram.
 */
export function validateWeightTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw ErrorCodes.VALIDATION_ERROR("Bảng giá phải có ít nhất một bậc khối lượng");
  }
  const sorted = tiers
    .map((tier) => ({
      fromGram: tier?.fromGram,
      toGram: tier?.toGram,
      basePrice: tier?.basePrice,
      pricePer500g: tier?.pricePer500g,
    }))
    .sort((a, b) => a.fromGram - b.fromGram);

  for (const tier of sorted) {
    if (![tier.fromGram, tier.toGram, tier.basePrice, tier.pricePer500g].every(isNumber)) {
      throw ErrorCodes.VALIDATION_ERROR("Mỗi bậc cần fromGram, toGram, basePrice, pricePer500g là số");
    }
    if (tier.fromGram < 0 || tier.basePrice < 0 || tier.pricePer500g < 0) {
      throw ErrorCodes.VALIDATION_ERROR("Khối lượng và giá không được âm");
    }
    if (tier.toGram <= tier.fromGram) {
      throw ErrorCodes.VALIDATION_ERROR(`Bậc ${tier.fromGram} g: toGram phải lớn hơn fromGram`);
    }
  }
  if (sorted[0].fromGram !== 0) {
    throw ErrorCodes.VALIDATION_ERROR("Bậc đầu tiên phải bắt đầu từ 0 g");
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.fromGram < prev.toGram) {
      throw ErrorCodes.VALIDATION_ERROR(
        `Bậc ${prev.fromGram}–${prev.toGram} g chồng lấn với bậc ${cur.fromGram}–${cur.toGram} g`,
      );
    }
    if (cur.fromGram > prev.toGram) {
      throw ErrorCodes.VALIDATION_ERROR(`Hở khoảng trống từ ${prev.toGram} g đến ${cur.fromGram} g`);
    }
  }
  return sorted;
}

/** Bac ap dung cho mot khoi luong (gram): fromGram <= weight < toGram; vuot bac cuoi -> bac cuoi. */
export function findTier(tiers, weight) {
  return tiers.find((t) => weight >= t.fromGram && weight < t.toGram) ?? tiers[tiers.length - 1];
}

function parseDate(value, field, { optional = false } = {}) {
  if (value === null || value === "" || value === undefined) {
    if (optional) return null;
    throw ErrorCodes.VALIDATION_ERROR(`Thiếu ${field}`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ErrorCodes.VALIDATION_ERROR(`${field} không phải ngày hợp lệ`);
  return date;
}

function checkPeriod(from, to) {
  if (to && to <= from) throw ErrorCodes.VALIDATION_ERROR("effectiveTo phải sau effectiveFrom");
}

// Strategy kiem tra du lieu bang gia (US-13). Rang buoc can doc CSDL (trung khoang hieu
// luc, da dung cho don hang) nam o PriceTableService.
export const priceTableValidator = {
  create(body) {
    const { serviceTypeId, zone } = body;
    if (!serviceTypeId) throw ErrorCodes.VALIDATION_ERROR("Thiếu serviceTypeId");
    if (!ZONE.includes(zone)) throw ErrorCodes.VALIDATION_ERROR(`zone phải là một trong: ${ZONE.join(", ")}`);
    const effectiveFrom = parseDate(body.effectiveFrom, "effectiveFrom");
    const effectiveTo = parseDate(body.effectiveTo, "effectiveTo", { optional: true });
    checkPeriod(effectiveFrom, effectiveTo);
    return {
      serviceTypeId,
      zone,
      weightTiers: validateWeightTiers(body.weightTiers),
      effectiveFrom,
      effectiveTo,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };
  },

  // serviceTypeId va zone khong doi sau khi tao (doi = tao bang gia moi)
  update(body) {
    const data = {};
    if (body.weightTiers !== undefined) data.weightTiers = validateWeightTiers(body.weightTiers);
    if (body.effectiveFrom !== undefined) data.effectiveFrom = parseDate(body.effectiveFrom, "effectiveFrom");
    if (body.effectiveTo !== undefined) data.effectiveTo = parseDate(body.effectiveTo, "effectiveTo", { optional: true });
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (data.effectiveFrom && data.effectiveTo) checkPeriod(data.effectiveFrom, data.effectiveTo);
    return data;
  },
};
