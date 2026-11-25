// Cong thuc tinh phi van chuyen (US-17) - ham THUAN, khong DB, la nguon su thuc duy
// nhat: uoc tinh phi cong khai (US-16), tao don (US-18) va seed du lieu deu goi vao day.
//
//   chargeableWeight = max(weightGram, dai x rong x cao (cm) / 5000 x 1000)
//   fee.total = base                // theo zone va bac khoi luong [fromGram, toGram)
//             + weightSurcharge     // pricePer500g x so buoc 500 g vuot trong bac
//             + serviceSurcharge    // base x serviceType.surchargeRate (gui nhanh)
//             + specialSurcharge    // de vo, gia tri cao, xe may
import { findTier } from "../priceTables/priceTables.validator.js";

export const VOLUMETRIC_DIVISOR = 5000;
export const STEP_GRAM = 500;
export const SPECIAL_SURCHARGE = { fragile: 5000, highValue: 10000, isVehicle: 50000 };
// Khai gia tu muc nay tro len thi tu tinh la hang gia tri cao (khach khong bo chon duoc)
export const HIGH_VALUE_FROM = 5_000_000;

export const ZONE_LABELS = {
  INNER_WARD: "nội xã/phường",
  INNER_PROVINCE: "nội tỉnh",
  INTER_PROVINCE: "liên tỉnh",
  INTER_REGION: "liên miền",
};

/** Vung tinh gia tu cap (khu vuc gui, khu vuc nhan) - moi khu vuc co province, ward, region. */
export function calcZone(pickupArea, receiverArea) {
  if (pickupArea.province === receiverArea.province) {
    return pickupArea.ward === receiverArea.ward ? "INNER_WARD" : "INNER_PROVINCE";
  }
  return pickupArea.region === receiverArea.region ? "INTER_PROVINCE" : "INTER_REGION";
}

// Dich vu chi chay trong cung tinh/thanh (yeu cau 12/11/2026: gui sang tinh khac khong co giao nhanh)
export const SAME_PROVINCE_ONLY = ["EXPRESS"];

/** Ly do loai dich vu khong ap dung cho cap khu vuc gui - nhan; null = dung duoc. */
export function unavailableReason(serviceType, pickupArea, receiverArea) {
  if (SAME_PROVINCE_ONLY.includes(serviceType.code) && pickupArea.province !== receiverArea.province) {
    return `${serviceType.name} chỉ áp dụng trong cùng tỉnh/thành — đơn từ ${pickupArea.province} đi ${receiverArea.province} chọn giao tiêu chuẩn`;
  }
  return null;
}

/** Khoi luong quy doi (gram) tu kich thuoc cm: 1 kg cho moi 5000 cm3. */
export function calcVolumetricWeight({ length, width, height }) {
  return Math.round(((length * width * height) / VOLUMETRIC_DIVISOR) * 1000);
}

export function calcChargeableWeight(item) {
  return Math.max(item.weightGram, calcVolumetricWeight(item));
}

/** Co hang dac biet that su ap dung: khai gia >= 5 trieu thi luon la hang gia tri cao. */
export function resolveFlags(flags = {}, declaredValue = 0) {
  return {
    fragile: flags.fragile === true,
    highValue: flags.highValue === true || declaredValue >= HIGH_VALUE_FROM,
    isVehicle: flags.isVehicle === true,
  };
}

// Gia base ung voi 500 g dau cua bac; moi 500 g (lam tron len) vuot qua do cong mot
// pricePer500g. Vd bac 1000-2000 g: 1000-1500 g = base, 1501-2000 g = base + 1 buoc.
function weightSurchargeSteps(excessGram) {
  if (excessGram <= 0) return 0;
  return Math.max(0, Math.ceil(excessGram / STEP_GRAM) - 1);
}

export function calcFee({ weightTiers, surchargeRate, chargeableWeight, flags }) {
  const tier = findTier(weightTiers, chargeableWeight);
  const base = tier.basePrice;
  const weightSurcharge = weightSurchargeSteps(chargeableWeight - tier.fromGram) * tier.pricePer500g;
  // Phu phi dich vu chi nhan tren base: gui nhanh khong nhan doi phan phu phi khoi luong
  const serviceSurcharge = Math.round(base * surchargeRate);
  const specialSurcharge = Object.keys(SPECIAL_SURCHARGE).reduce(
    (sum, key) => sum + (flags[key] ? SPECIAL_SURCHARGE[key] : 0),
    0,
  );
  return {
    base,
    weightSurcharge,
    serviceSurcharge,
    specialSurcharge,
    total: base + weightSurcharge + serviceSurcharge + specialSurcharge,
  };
}

/**
 * pricingService.calculate(): bao gia day du cho MOT loai dich vu khi da biet bang gia
 * ap dung (bang gia chon theo zone - xem PricingService.quote).
 * @returns {{ chargeableWeight, volumetricWeight, flags, fee }}
 */
export function calculate({ item, flags, serviceType, priceTable }) {
  const volumetricWeight = calcVolumetricWeight(item);
  const chargeableWeight = Math.max(item.weightGram, volumetricWeight);
  const appliedFlags = resolveFlags(flags, item.declaredValue);
  const fee = calcFee({
    weightTiers: priceTable.weightTiers,
    surchargeRate: serviceType.surchargeRate,
    chargeableWeight,
    flags: appliedFlags,
  });
  return { chargeableWeight, volumetricWeight, flags: appliedFlags, fee };
}
