// US-33: ma VietQR chuyen khoan tu sinh (EMVCo / Napas 247) - ham thuan, khong can CSDL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK_BINS, buildVietQr, companyAccount, crc16, parseTlv, transferNote } from "../src/modules/payments/vietqr.js";
import { BANKS } from "../src/modules/profile/bankAccount.js";

test("[US-33] VietQR: CRC-16/CCITT dung chuan (\"123456789\" -> 29B1), ma dong co so tien, chuyen vao tai khoan qua Napas", () => {
  assert.equal(crc16("123456789"), "29B1");
  const payload = buildVietQr({ bankCode: "VCB", accountNo: "0011004012345", amount: 246000, note: "EDMS EXP1000000366" });
  const top = parseTlv(payload);
  assert.equal(top["00"], "01", "phien ban EMVCo");
  assert.equal(top["01"], "12", "ma dong (co so tien, dung mot lan)");
  assert.equal(top["53"], "704", "VND");
  assert.equal(top["54"], "246000");
  assert.equal(top["58"], "VN");
  const merchant = parseTlv(top["38"]);
  assert.equal(merchant["00"], "A000000727", "Napas");
  assert.equal(merchant["02"], "QRIBFTTA", "chuyen nhanh den tai khoan");
  assert.deepEqual(parseTlv(merchant["01"]), { "00": "970436", "01": "0011004012345" });
  assert.equal(parseTlv(top["62"])["08"], "EDMS EXP1000000366");
  assert.equal(top["63"], crc16(payload.slice(0, -4)), "CRC tinh tren toan chuoi, ket thuc bang 6304");
  assert.ok(payload.endsWith(top["63"]));
});

test("[US-33] VietQR: noi dung chuyen khoan khong dau, toi da 25 ky tu; chan so tien va tai khoan sai; du ma BIN cho moi ngan hang", () => {
  assert.equal(transferNote("Đơn EXP1000000366 — giao lần 2"), "DON EXP1000000366 GIAO LA", "cat o 25 ky tu");
  assert.throws(() => buildVietQr({ bankCode: "VCB", accountNo: "0011", amount: 1000 }), /6-19/);
  assert.throws(() => buildVietQr({ bankCode: "VCB", accountNo: "0011004012345", amount: 0 }), /nguyen duong/);
  assert.throws(() => buildVietQr({ bankCode: "XYZ", accountNo: "0011004012345", amount: 1000 }), /chua ho tro/);
  for (const bank of BANKS) assert.match(BANK_BINS[bank.code] || "", /^970\d{3}$/, `thieu BIN ${bank.code}`);
});

test("[US-33] tai khoan nhan chuyen khoan: da cau hinh thi dung that; may dev chua cau hinh dung tai khoan DEMO khong ton tai; chay that chua cau hinh thi khong co", () => {
  assert.deepEqual(companyAccount({ code: "MB", accountNo: "123456789", accountName: "CONG TY EDMS" }, "production"), {
    code: "MB",
    accountNo: "123456789",
    accountName: "CONG TY EDMS",
    demo: false,
  });
  const demo = companyAccount({}, "development");
  assert.equal(demo.demo, true);
  assert.equal(demo.accountNo, "0000000000");
  assert.equal(companyAccount({}, "production"), null);
});
