// Seed tinh phi bang CHINH cong thuc nghiep vu (src/modules/pricing/pricing.js, US-17) -
// mot nguon su thuc duy nhat, khong con ban rut gon rieng cho du lieu demo.
import { calcFee as calcFeeFromTiers } from "../modules/pricing/pricing.js";

export { calcZone, calcChargeableWeight } from "../modules/pricing/pricing.js";

export function calcFee({ priceTable, serviceType, chargeableWeight, flags }) {
  return calcFeeFromTiers({
    weightTiers: priceTable.weightTiers,
    surchargeRate: serviceType.surchargeRate,
    chargeableWeight,
    flags,
  });
}
