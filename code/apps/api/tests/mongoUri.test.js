// Unit test chuan hoa chuoi ket noi Atlas (khong can mang, khong can CSDL).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMongoUri, upsertEnvValue } from "../src/config/mongoUri.js";

const ATLAS = "mongodb+srv://edms_app:MatKhau123@edms.abcde.mongodb.net/?retryWrites=true&w=majority&appName=edms";

test("[US-02] Chuoi copy tu Atlas: tu them /edms truoc dau ?", () => {
  const r = normalizeMongoUri(ATLAS);
  assert.equal(r.uri, "mongodb+srv://edms_app:MatKhau123@edms.abcde.mongodb.net/edms?retryWrites=true&w=majority&appName=edms");
  assert.equal(r.host, "edms.abcde.mongodb.net");
  assert.equal(r.dbName, "edms");
});

test("[US-02] Da co ten database thi giu nguyen, khong bao thay doi", () => {
  const r = normalizeMongoUri("mongodb+srv://u:p@c.mongodb.net/edms?w=majority");
  assert.equal(r.uri, "mongodb+srv://u:p@c.mongodb.net/edms?w=majority");
  assert.deepEqual(r.changes, []);
});

test("[US-02] Mat khau co ky tu dac biet @ : / # duoc ma hoa tu dong", () => {
  const r = normalizeMongoUri("mongodb+srv://edms_app:a@b:c/d#e@c.mongodb.net/");
  assert.equal(r.uri, "mongodb+srv://edms_app:a%40b%3Ac%2Fd%23e@c.mongodb.net/edms");
  assert.equal(r.host, "c.mongodb.net");
});

test("[US-02] Mat khau da ma hoa san khong bi ma hoa lan hai", () => {
  const r = normalizeMongoUri("mongodb+srv://u:a%40b@c.mongodb.net/edms");
  assert.equal(r.uri, "mongodb+srv://u:a%40b@c.mongodb.net/edms");
});

test("[US-02] Bo dau nhay va khoang trang khi dan ca chuoi co nhay", () => {
  const r = normalizeMongoUri(`  "${ATLAS}"  `);
  assert.ok(r.uri.startsWith("mongodb+srv://edms_app:MatKhau123@"));
});

test("[US-02] Bao loi tieng Viet, khong lo mat khau", () => {
  assert.throws(() => normalizeMongoUri("https://cloud.mongodb.com"), /mongodb\+srv/);
  assert.throws(() => normalizeMongoUri(ATLAS.replace("MatKhau123", "<db_password>")), /chưa thay/);
  assert.throws(() => normalizeMongoUri("mongodb+srv://c.mongodb.net/"), /thiếu tên đăng nhập/);
  assert.throws(() => normalizeMongoUri("mongodb+srv://edms_app@c.mongodb.net/"), (err) => {
    assert.match(err.message, /thiếu tên đăng nhập hoặc mật khẩu/);
    return true;
  });
});

test("[US-02] Ghi MONGO_URI vao .env: thay dong cu, giu cac dong khac", () => {
  const before = "PORT=4044\n# MONGO_URI=cu-trong-comment\nMONGO_URI=mongodb://localhost:27018/edms\nREDIS_URL=redis://x\n";
  const after = upsertEnvValue(before, "MONGO_URI", "mongodb+srv://u:p$&@c/edms");
  assert.equal(after, "PORT=4044\n# MONGO_URI=cu-trong-comment\nMONGO_URI=mongodb+srv://u:p$&@c/edms\nREDIS_URL=redis://x\n");
  assert.equal(upsertEnvValue("PORT=4044", "MONGO_URI", "x"), "PORT=4044\nMONGO_URI=x\n");
});
