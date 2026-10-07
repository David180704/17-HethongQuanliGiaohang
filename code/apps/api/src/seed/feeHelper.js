// Ban rut gon cua cong thuc tinh phi, chi du dung cho seed du lieu demo.
// pricingService.calculate() chinh thuc (Dot 4.2, co 10 unit test) se duoc xay
// dung o nhanh sprint-3 va la nguon su thuc duy nhat luc chay nghiep vu thuc.

export function calcZone(pickupArea, receiverArea) {
  if (pickupArea.province === receiverArea.province && pickupArea.district === receiverArea.district) {
    return "INNER_DISTRICT";
  }
  if (pickupArea.province === receiverArea.province) return "INNER_PROVINCE";
  if (pickupArea.region === receiverArea.region) return "INTER_PROVINCE";
  return "INTER_REGION";
}

export function calcChargeableWeight(item) {
  const volumetricGram = ((item.length * item.width * item.height) / 5000) * 1000;
  return Math.max(item.weightGram, Math.round(volumetricGram));
}

function findTier(weightTiers, weight) {
  return (
    weightTiers.find((t) => weight >= t.fromGram && weight < t.toGram) ?? weightTiers[weightTiers.length - 1]
  );
}

// Quy uoc bac 500g: base gia cho 500g dau tien cua bac, moi 500g (tron len)
// vuot qua do cong them pricePer500g. Vi du bac 1000-2000g, basePrice ung voi
// 1000-1500g; tu 1501g cong 1 pricePer500g, tu 2001g (nhung da sang bac khac).
function weightSurchargeSteps(excessFromTierStart) {
  if (excessFromTierStart <= 0) return 0;
  return Math.max(0, Math.ceil(excessFromTierStart / 500) - 1);
}

export function calcFee({ priceTable, serviceType, chargeableWeight, flags }) {
  const tier = findTier(priceTable.weightTiers, chargeableWeight);
  const steps = weightSurchargeSteps(chargeableWeight - tier.fromGram);

  const base = tier.basePrice;
  const weightSurcharge = steps * tier.pricePer500g;
  const serviceSurcharge = Math.round(base * serviceType.surchargeRate);
  const specialSurcharge = (flags.fragile ? 5000 : 0) + (flags.highValue ? 10000 : 0) + (flags.isVehicle ? 50000 : 0);

  const total = base + weightSurcharge + serviceSurcharge + specialSurcharge;

  return { base, weightSurcharge, serviceSurcharge, specialSurcharge, total };
}
