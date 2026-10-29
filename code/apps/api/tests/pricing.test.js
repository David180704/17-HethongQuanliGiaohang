// US-17: 10 kich ban tinh phi - ham thuan pricing.js, khong can CSDL.
// Bang gia dung trong test giong bang gia seed "noi quan" (referenceData.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcZone, calculate, calcVolumetricWeight } from "../src/modules/pricing/pricing.js";

const INNER_DISTRICT_TABLE = {
  weightTiers: [
    { fromGram: 0, toGram: 500, basePrice: 15000, pricePer500g: 3000 },
    { fromGram: 500, toGram: 1000, basePrice: 18000, pricePer500g: 3000 },
    { fromGram: 1000, toGram: 2000, basePrice: 24000, pricePer500g: 3000 },
    { fromGram: 2000, toGram: 5000, basePrice: 33000, pricePer500g: 4000 },
    { fromGram: 5000, toGram: 999999999, basePrice: 45000, pricePer500g: 4000 },
  ],
};
const STANDARD = { code: "STANDARD", surchargeRate: 0 };
const EXPRESS = { code: "EXPRESS", surchargeRate: 0.5 };

const area = (province, district, region) => ({ province, district, region });
const HOAN_KIEM = area("Hà Nội", "Hoàn Kiếm", "BAC");
const smallBox = (weightGram, extra = {}) => ({ weightGram, length: 10, width: 10, height: 10, declaredValue: 0, ...extra });
const quote = (item, { serviceType = STANDARD, flags = {} } = {}) =>
  calculate({ item, flags, serviceType, priceTable: INNER_DISTRICT_TABLE });

test("[US-17] zone noi quan: cung tinh, cung quan/huyen", () => {
  assert.equal(calcZone(HOAN_KIEM, area("Hà Nội", "Hoàn Kiếm", "BAC")), "INNER_DISTRICT");
});

test("[US-17] zone noi tinh: cung tinh, khac quan/huyen", () => {
  assert.equal(calcZone(HOAN_KIEM, area("Hà Nội", "Cầu Giấy", "BAC")), "INNER_PROVINCE");
});

test("[US-17] zone lien tinh: khac tinh, cung mien", () => {
  assert.equal(calcZone(HOAN_KIEM, area("Bắc Ninh", "Tiên Du", "BAC")), "INTER_PROVINCE");
});

test("[US-17] zone lien mien: khac mien", () => {
  assert.equal(calcZone(HOAN_KIEM, area("TP Hồ Chí Minh", "Quận 1", "NAM")), "INTER_REGION");
});

test("[US-17] kien nhe nhung cong kenh: tinh theo khoi luong quy doi", () => {
  // 40 x 30 x 20 cm = 24000 cm3 -> 4,8 kg quy doi > 1 kg thuc
  const result = quote({ weightGram: 1000, length: 40, width: 30, height: 20, declaredValue: 0 });
  assert.equal(calcVolumetricWeight({ length: 40, width: 30, height: 20 }), 4800);
  assert.equal(result.chargeableWeight, 4800);
  // Bac 2000-5000 g: base 33.000 + 5 buoc x 4.000 (2.800 g vuot -> lam tron 6 buoc 500 g, tru buoc dau)
  assert.deepEqual(result.fee, { base: 33000, weightSurcharge: 20000, serviceSurcharge: 0, specialSurcharge: 0, total: 53000 });
});

test("[US-17] kien nang nho gon: tinh theo khoi luong thuc", () => {
  const result = quote(smallBox(1200)); // quy doi 10x10x10 = 200 g
  assert.equal(result.volumetricWeight, 200);
  assert.equal(result.chargeableWeight, 1200);
  assert.equal(result.fee.total, 24000);
});

test("[US-17] ranh gioi bac: 499 g o bac dau, dung 500 g sang bac 500-1000 g", () => {
  assert.equal(quote(smallBox(499)).fee.total, 15000);
  assert.equal(quote(smallBox(500)).fee.total, 18000);
  assert.equal(quote(smallBox(999)).fee.total, 18000);
  assert.equal(quote(smallBox(1000)).fee.total, 24000);
});

test("[US-17] phu phi khoi luong theo buoc 500 g trong bac: 1500 g chua cong, 1501 g cong 1 buoc", () => {
  assert.equal(quote(smallBox(1500)).fee.weightSurcharge, 0);
  assert.equal(quote(smallBox(1501)).fee.weightSurcharge, 3000);
  assert.equal(quote(smallBox(1999)).fee.weightSurcharge, 3000);
});

test("[US-17] gui nhanh: phu phi dich vu = base x 50%, khong nhan len phan phu phi khoi luong", () => {
  const standard = quote(smallBox(1501)).fee;
  const express = quote(smallBox(1501), { serviceType: EXPRESS }).fee;
  assert.deepEqual(express, { base: 24000, weightSurcharge: 3000, serviceSurcharge: 12000, specialSurcharge: 0, total: 39000 });
  assert.equal(express.total - standard.total, 12000);
});

test("[US-17] hang dac biet: de vo + gia tri cao (khai gia tu 5 trieu) + xe may cong dung tung khoan", () => {
  const cheap = quote(smallBox(300, { declaredValue: 4_999_999 }), { flags: { fragile: true } });
  assert.deepEqual(cheap.flags, { fragile: true, highValue: false, isVehicle: false });
  assert.equal(cheap.fee.specialSurcharge, 5000);

  // Khai gia 6 trieu: tu tinh gia tri cao du khach khong chon
  const valuable = quote(smallBox(300, { declaredValue: 6_000_000 }), { flags: { fragile: true, isVehicle: true } });
  assert.deepEqual(valuable.flags, { fragile: true, highValue: true, isVehicle: true });
  assert.equal(valuable.fee.specialSurcharge, 5000 + 10000 + 50000);
  assert.equal(valuable.fee.total, 15000 + 65000);
});
