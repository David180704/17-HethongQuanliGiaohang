// Dia gioi 2 cap tu 01/07/2025 (yeu cau thay doi 12/11/2026): tinh/thanh -> xa/phuong, khong con quan/huyen.
// Kiem: khop ten go tay voi danh muc that, API danh muc cong khai, khoang cach, giao nhanh chi trong tinh.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getRedis } from "../src/config/redis.js";
import { PROVINCES, checkAddress, findProvince } from "../src/modules/adminUnits/adminUnits.js";
import { distanceBetween } from "../src/modules/adminUnits/distance.js";
import { unavailableReason } from "../src/modules/pricing/pricing.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
let app;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();
});

after(async () => {
  await getRedis().quit();
  await mongoose.disconnect();
});

test("[US-15] danh muc hanh chinh 2025: 34 tinh/thanh, 3.321 xa/phuong, khong con quan/huyen", () => {
  assert.equal(PROVINCES.length, 34);
  assert.equal(PROVINCES.reduce((n, p) => n + p.wards.length, 0), 3321);
  assert.equal(findProvince("Hà Nội").wards.length, 126);
  assert.equal(findProvince("thanh pho ho chi minh").name, "TP Hồ Chí Minh");
  assert.ok(PROVINCES.every((p) => p.wards.every((w) => /^(Phường|Xã|Đặc khu) /.test(w))), "moi ten deu co tien to Phuong/Xa/Dac khu");
});

test("[US-15] go tay: khong dau, thieu tien to van nhan va tra ten chuan; sai tinh, ten cu, quan/huyen bi tu choi", () => {
  assert.deepEqual(checkAddress("ha noi", "ba dinh"), { ok: true, province: "Hà Nội", ward: "Phường Ba Đình" });
  assert.deepEqual(checkAddress("Thành phố Hồ Chí Minh", "Sài Gòn"), { ok: true, province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" });
  assert.deepEqual(checkAddress("tinh bac ninh", "tien du"), { ok: true, province: "Bắc Ninh", ward: "Xã Tiên Du" });
  for (const [province, ward, field] of [
    ["Hà Nội", "Phường Sài Gòn", "ward"], // phuong co that nhung thuoc tinh khac
    ["TP Hồ Chí Minh", "Bến Nghé", "ward"], // ten cu truoc sap nhap
    ["Hà Nội", "Quận Cầu Giấy", "ward"], // cap quan/huyen da bo
    ["Hà Nộii", "Ba Đình", "province"],
  ]) {
    const res = checkAddress(province, ward);
    assert.equal(res.ok, false, `${ward}, ${province}`);
    assert.equal(res.field, field);
  }
  // Bo dau ra hai ten (Văn Lang / Văn Lăng) -> mo ho, phai go du dau
  assert.equal(checkAddress("Thái Nguyên", "van lang").ok, false);
  assert.equal(checkAddress("Thái Nguyên", "Văn Lăng").ward, "Xã Văn Lăng");
});

test("[US-15] API cong khai: 34 tinh kem so xa/phuong phuc vu; xa/phuong theo tinh; tim kiem toi da 50 dong", async () => {
  const provinces = await request(app).get("/public/provinces");
  assert.equal(provinces.status, 200);
  assert.equal(provinces.body.data.length, 34);
  const hn = provinces.body.data.find((p) => p.name === "Hà Nội");
  assert.equal(hn.wardCount, 126);
  assert.ok(hn.servedCount >= 120);

  const wards = await request(app).get("/public/provinces/wards").query({ province: "ho chi minh" });
  assert.equal(wards.status, 200);
  assert.equal(wards.body.data.province, "TP Hồ Chí Minh");
  assert.equal(wards.body.data.wards.length, 168);
  assert.ok(wards.body.data.wards.some((w) => w.name === "Phường Bến Thành" && w.served));

  const bad = await request(app).get("/public/provinces/wards").query({ province: "Tỉnh Không Có" });
  assert.equal(bad.status, 400);

  const search = await request(app).get("/public/service-areas").query({ search: "tan" });
  assert.equal(search.status, 200);
  assert.ok(search.body.data.length <= 50, "khong tra ca nghin dong");
});

test("[US-16] dia chi go sai tinh bi 400 VALIDATION_ERROR (khac ngoai vung phuc vu 422)", async () => {
  const res = await request(app)
    .post("/orders/estimate-fee")
    .send({
      pickup: { province: "Hà Nội", ward: "Quận Cầu Giấy" },
      receiver: { province: "Hà Nội", ward: "Phường Hoàn Kiếm" },
      item: { weightGram: 500, length: 10, width: 10, height: 10 },
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
  assert.match(res.body.error.message, /"Quận Cầu Giấy" không thuộc Hà Nội/);
});

test("[US-16] khoang cach duong chim bay giua tam hai xa/phuong; cung xa/phuong = 0", () => {
  const hn = { province: "Hà Nội", ward: "Phường Hoàn Kiếm" };
  assert.deepEqual(distanceBetween(hn, hn), { km: 0, approx: false });
  const toHcm = distanceBetween(hn, { province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" });
  assert.ok(toHcm.km > 1000 && toHcm.km < 1300, `HN - HCM ${toHcm.km} km`);
  const inside = distanceBetween(hn, { province: "Hà Nội", ward: "Phường Cầu Giấy" });
  assert.ok(inside.km > 1 && inside.km < 20, `noi thanh Ha Noi ${inside.km} km`);
});

test("[US-16] giao nhanh chi trong cung tinh/thanh; giao tieu chuan di moi noi", () => {
  const express = { code: "EXPRESS", name: "Giao hàng nhanh" };
  const standard = { code: "STANDARD", name: "Giao hàng tiêu chuẩn" };
  const hn = { province: "Hà Nội" };
  const hcm = { province: "TP Hồ Chí Minh" };
  assert.equal(unavailableReason(express, hn, hn), null);
  assert.match(unavailableReason(express, hn, hcm), /chỉ áp dụng trong cùng tỉnh\/thành/);
  assert.equal(unavailableReason(standard, hn, hcm), null);
});
