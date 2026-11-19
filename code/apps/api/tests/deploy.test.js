// US-45: chay that tren may chu (Render + MongoDB Atlas). Kiem cau hinh bat buoc khi NODE_ENV=production va
// file render.yaml (Blueprint) khop nhau: dia chi API, CORS cho hai trang web, Redis cho BullMQ, secret khong nam trong git.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { productionProblems } from "../src/config/productionCheck.js";

const source = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
// Git tren Windows co the doi xuong dong thanh CRLF
const blueprint = readFileSync(fileURLToPath(new URL("../../../../render.yaml", import.meta.url)), "utf8").replace(/\r\n/g, "\n");

const GOOD = {
  NODE_ENV: "production",
  MONGO_URI: "mongodb+srv://edms:mat-khau@cluster0.abcde.mongodb.net/edms",
  REDIS_URL: "redis://red-abc123:6379",
  JWT_ACCESS_SECRET: "a".repeat(40),
  JWT_REFRESH_SECRET: "b".repeat(40),
  CORS_ORIGIN: "https://edms17-web.onrender.com,https://edms17-nhanvien.onrender.com",
  PUBLIC_API_URL: "https://edms17-api.onrender.com",
};

test("[US-45] chay that: thieu cau hinh hoac dung secret mac dinh thi API khong khoi dong", () => {
  assert.deepEqual(productionProblems({ NODE_ENV: "development" }), [], "may dev dung mac dinh");
  assert.deepEqual(productionProblems(GOOD), []);

  const problems = productionProblems({ NODE_ENV: "production", JWT_ACCESS_SECRET: "dev-access-secret" });
  for (const pattern of [/MONGO_URI/, /REDIS_URL/, /JWT_ACCESS_SECRET/, /JWT_REFRESH_SECRET/, /CORS_ORIGIN/, /PUBLIC_API_URL/]) {
    assert.ok(problems.some((p) => pattern.test(p)), `phai bao ${pattern}`);
  }
  assert.match(productionProblems({ ...GOOD, MONGO_URI: "mongodb://localhost:27018/edms" }).join(), /Atlas/);
  assert.match(productionProblems({ ...GOOD, JWT_REFRESH_SECRET: GOOD.JWT_ACCESS_SECRET }).join(), /phải khác nhau/);
  assert.match(productionProblems({ ...GOOD, CORS_ORIGIN: "http://edms17-web.onrender.com" }).join(), /https:\/\//);
});

test("[US-45] render.yaml: API, Redis, hai trang web cung dia chi; secret khong ghi trong file", () => {
  const value = (key) => blueprint.match(new RegExp(`key: ${key}\\n\\s+value: (.+)`))?.[1].trim();
  const api = value("PUBLIC_API_URL");
  assert.match(api, /^https:\/\/[a-z0-9-]+\.onrender\.com$/);
  assert.equal(value("VITE_API_URL"), api, "Web Khach hang goi dung API");
  assert.equal(value("EXPO_PUBLIC_API_URL"), api, "Web Nhan vien goi dung API");
  const origins = value("CORS_ORIGIN").split(",");
  for (const site of ["edms17-web", "edms17-nhanvien"]) {
    assert.ok(blueprint.includes(`name: ${site}`));
    assert.ok(origins.includes(`https://${site}.onrender.com`), `CORS mo cho ${site}`);
  }
  assert.match(blueprint, /key: NODE_ENV\n\s+value: production/);
  assert.match(blueprint, /maxmemoryPolicy: noeviction/, "BullMQ can Redis khong tu xoa du lieu");
  for (const secret of ["MONGO_URI", "VNPAY_TMN_CODE", "VNPAY_HASH_SECRET"]) {
    assert.match(blueprint, new RegExp(`key: ${secret}\\n\\s+sync: false`), `${secret} nhap tren Render, khong nam trong git`);
  }
  for (const secret of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    assert.match(blueprint, new RegExp(`key: ${secret}\\n\\s+generateValue: true`), `${secret} do Render sinh ngau nhien`);
  }
  assert.doesNotMatch(blueprint, /mongodb(\+srv)?:\/\//, "khong ghi chuoi ket noi CSDL");
});

// US-47: hai app cai tren dien thoai that goi API tren may chu, co ten goi Android co dinh, scheme cho deep link
// (VNPay tra ve App Khach hang), ban APK de cai thu va ban AAB tai len kenh thu nghiem noi bo CH Play.
const appConfig = (app) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../${app}/app.json`, import.meta.url)), "utf8")).expo;
const easConfig = (app) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../${app}/eas.json`, import.meta.url)), "utf8"));

test("[US-47] App Khach hang, App Nhan vien: ten goi, scheme, ban APK / AAB goi dung API tren may chu", () => {
  const api = blueprint.match(/key: PUBLIC_API_URL\n\s+value: (.+)/)[1].trim();
  const apps = [
    ["customer-mobile", "vn.edms17.khachhang", "edmskh"],
    ["staff", "vn.edms17.nhanvien", "edmsnv"],
  ];
  for (const [app, pkg, scheme] of apps) {
    const expo = appConfig(app);
    assert.equal(expo.android.package, pkg, `${app}: ten goi Android`);
    assert.equal(expo.scheme, scheme, `${app}: scheme deep link`);
    assert.ok(Number.isInteger(expo.android.versionCode) && expo.android.versionCode >= 1);
    assert.deepEqual(expo.android.permissions, [], `${app}: khong xin quyen nhay cam`);
    const eas = easConfig(app);
    assert.equal(eas.build.preview.android.buildType, "apk", "ban cai thu tren may that");
    assert.equal(eas.build.production.android.buildType, "app-bundle", "ban tai len CH Play");
    for (const profile of ["preview", "production"]) {
      assert.equal(eas.build[profile].env.EXPO_PUBLIC_API_URL, api, `${app} ${profile}: goi API tren may chu`);
    }
    assert.equal(eas.submit.production.android.track, "internal", "kenh thu nghiem noi bo");
  }
  // Deep link VNPay tra ve app khach phai nam trong danh sach API cho phep
  assert.ok(source("api/src/config/env.js").includes("edmskh://"));
  // CH Play bat buoc chinh sach quyen rieng tu cong khai
  assert.match(source("web/src/App.jsx"), /path="chinh-sach-quyen-rieng-tu"/);
});
