// US-46: hai nen tang (web, di dong) deu co ban cho nhan vien va ban cho khach. Ban nhan vien (App Nhan vien
// di dong + Web Nhan vien) gui app=STAFF, ban khach (App Khach hang di dong + Web Khach hang) gui app=CUSTOMER;
// API chi cap token khi vai tro dung voi ban ung dung. Dung tai khoan mau cua seed (mat khau 123456).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getRedis } from "../src/config/redis.js";

const URI = "mongodb://localhost:27018/edms?directConnection=true";
const source = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");

let app;

before(async () => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
  app = createApp();
});

after(async () => {
  await getRedis().quit();
  await mongoose.disconnect();
});

test("[US-46] moi ung dung gui dung loai ban: nhan vien (web + di dong) STAFF, khach (web + di dong) CUSTOMER", () => {
  const sends = (path) => source(path).match(/post\("\/auth\/login", \{[^}]*app: "(\w+)"/)?.[1];
  assert.equal(sends("staff/src/auth/AuthContext.js"), "STAFF", "App Nhan vien - ban di dong va ban Web Nhan vien dung chung ma");
  assert.equal(sends("web/src/context/AuthContext.jsx"), "CUSTOMER", "Web Khach hang");
  assert.equal(sends("customer-mobile/src/auth/AuthContext.js"), "CUSTOMER", "App Khach hang di dong");
});

// LUONG nghiep vu: admin, nhan vien kho, tai xe dung Web Nhan vien; khach dung Web Khach hang - moi nguoi vao dung
// nen tang cua minh, mo nham nen tang kia thi bi tu choi va khong nhan token.
test("[US-46] luong nghiep vu: moi vai tro dang nhap dung nen tang cua minh, nham nen tang thi bi tu choi", async () => {
  const login = (email, appName) => request(app).post("/auth/login").send({ emailOrPhone: email, password: "123456", app: appName });
  for (const [email, role] of [["admin@edms.vn", "ADMIN"], ["kho1@edms.vn", "HUB_STAFF"], ["taixe1@edms.vn", "SHIPPER"]]) {
    const ok = await login(email, "STAFF");
    assert.equal(ok.status, 200, `${email}: ${JSON.stringify(ok.body)}`);
    assert.equal(ok.body.data.user.role, role);
    const wrong = await login(email, "CUSTOMER");
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.error.code, "WRONG_APP");
    assert.equal(wrong.body.data, undefined, "khong cap token");
  }
  const customer = await login("khach1@edms.vn", "CUSTOMER");
  assert.equal(customer.status, 200);
  const customerOnStaff = await login("khach1@edms.vn", "STAFF");
  assert.equal(customerOnStaff.body.error.code, "WRONG_APP");
  assert.match(customerOnStaff.body.error.message, /dùng App Khách hàng/);
});
