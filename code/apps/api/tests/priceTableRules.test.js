// 8 unit test ranh gioi bac khoi luong (US-13) - ham thuan, khong can CSDL.
// Quy uoc: kien thuoc bac khi fromGram <= khoi luong < toGram.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findTier, validateWeightTiers } from "../src/modules/priceTables/priceTables.validator.js";

const tier = (fromGram, toGram, basePrice = 15000) => ({ fromGram, toGram, basePrice, pricePer500g: 3000 });
const TIERS = [tier(0, 500, 15000), tier(500, 1000, 18000), tier(1000, 2000, 24000), tier(2000, 999999999, 33000)];

const rejects = (tiers, pattern) =>
  assert.throws(() => validateWeightTiers(tiers), (err) => err.code === "VALIDATION_ERROR" && pattern.test(err.message));

test("[US-13] bac noi tiep 0-500-1000-2000-... hop le", () => {
  assert.deepEqual(validateWeightTiers(TIERS), TIERS);
});

test("[US-13] nhap bac lon xon thi duoc sap lai theo fromGram", () => {
  const shuffled = [TIERS[2], TIERS[0], TIERS[3], TIERS[1]];
  assert.deepEqual(validateWeightTiers(shuffled), TIERS);
});

test("[US-13] hai bac chong lan (500-1000 va 900-2000) bi tu choi", () => {
  rejects([tier(0, 500), tier(500, 1000), tier(900, 2000)], /chồng lấn/);
});

test("[US-13] ho khoang trong (1000 -> 1200) bi tu choi", () => {
  rejects([tier(0, 500), tier(500, 1000), tier(1200, 2000)], /Hở khoảng trống từ 1000 g đến 1200 g/);
});

test("[US-13] bac dau khong bat dau tu 0 g bi tu choi", () => {
  rejects([tier(100, 500), tier(500, 1000)], /bắt đầu từ 0 g/);
});

test("[US-13] bac co toGram <= fromGram bi tu choi", () => {
  rejects([tier(0, 500), tier(500, 500)], /toGram phải lớn hơn fromGram/);
});

test("[US-13] ranh gioi: dung 500 g thuoc bac 500-1000, 499 g thuoc bac 0-500", () => {
  assert.equal(findTier(TIERS, 0).basePrice, 15000);
  assert.equal(findTier(TIERS, 499).basePrice, 15000);
  assert.equal(findTier(TIERS, 500).basePrice, 18000);
  assert.equal(findTier(TIERS, 999.9).basePrice, 18000);
});

test("[US-13] ranh gioi: dung 1000 g, 2000 g sang bac tiep theo; vuot bac cuoi van tinh bac cuoi", () => {
  assert.equal(findTier(TIERS, 1000).basePrice, 24000);
  assert.equal(findTier(TIERS, 2000).basePrice, 33000);
  assert.equal(findTier(TIERS, 2_000_000_000).basePrice, 33000);
});
