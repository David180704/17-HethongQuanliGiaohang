// Ma VietQR chuyen khoan (chuan EMVCo / Napas 247) tu sinh trong he thong, khong qua cong thanh toan, khong mat phi.
// Dung khi nguoi nhan tra tien thu ho / phi bang chuyen khoan luc giao: tai xe hien QR dung so tien, noi dung la ma
// van don; nguoi nhan mo app ngan hang bat ky quet -> chuyen vao tai khoan cong ty. Tai xe ghi ma giao dich (US-33).

import { Buffer } from "node:buffer";

// Ma BIN Napas cua cac ngan hang (cung danh sach ma o bankAccount.js)
export const BANK_BINS = {
  VCB: "970436",
  CTG: "970415",
  BIDV: "970418",
  AGR: "970405",
  TCB: "970407",
  MB: "970422",
  ACB: "970416",
  VPB: "970432",
  TPB: "970423",
  STB: "970403",
  VIB: "970441",
  SHB: "970443",
  HDB: "970437",
  OCB: "970448",
  MSB: "970426",
};

const NAPAS_GUID = "A000000727";
const SERVICE_TRANSFER_TO_ACCOUNT = "QRIBFTTA";

/** CRC-16/CCITT-FALSE (poly 0x1021, khoi tao 0xFFFF) - truong 63 cua ma EMVCo. */
export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Mot truong TLV: ma 2 so + do dai 2 so + gia tri. */
export function tlv(id, value) {
  const v = String(value);
  if (v.length > 99) throw new Error(`Truong ${id} qua dai`);
  return `${id}${String(v.length).padStart(2, "0")}${v}`;
}

/** Tach chuoi TLV thanh { ma: gia tri } (dung de kiem tra / doc lai ma). */
export function parseTlv(text) {
  const out = {};
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    out[id] = text.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

/** Noi dung chuyen khoan: ngan hang chi nhan chu khong dau, so, khoang trang; toi da 25 ky tu (EMVCo 62-08). */
export function transferNote(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 25);
}

/**
 * Tai khoan nhan chuyen khoan cua cong ty (env COMPANY_BANK_*). May dev chua cau hinh -> tai khoan DEMO khong ton tai
 * (an toan: quet thu khong chuyen nham cho ai); chay that chua cau hinh -> null (API bao chua cau hinh).
 */
export function companyAccount({ code, accountNo, accountName } = {}, nodeEnv = "development") {
  if (code && accountNo) return { code, accountNo: String(accountNo), accountName: accountName || "", demo: false };
  if (nodeEnv === "production") return null;
  return { code: "VCB", accountNo: "0000000000", accountName: "EDMS DEMO - KHONG CHUYEN TIEN", demo: true };
}

/**
 * Chuoi ma VietQR dong (co so tien). bankCode theo BANK_BINS, so tai khoan 6-19 chu so, so tien nguyen duong (VND).
 * @returns {string}
 */
export function buildVietQr({ bankCode, accountNo, amount, note }) {
  const bin = BANK_BINS[bankCode];
  if (!bin) throw new Error(`Ngan hang ${bankCode} chua ho tro`);
  if (!/^\d{6,19}$/.test(String(accountNo))) throw new Error("So tai khoan phai gom 6-19 chu so");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("So tien phai la so nguyen duong");
  const beneficiary = tlv("00", bin) + tlv("01", accountNo);
  const body =
    tlv("00", "01") +
    tlv("01", "12") + // 12: ma dong, dung mot lan cho mot so tien
    tlv("38", tlv("00", NAPAS_GUID) + tlv("01", beneficiary) + tlv("02", SERVICE_TRANSFER_TO_ACCOUNT)) +
    tlv("53", "704") + // VND
    tlv("54", String(amount)) +
    tlv("58", "VN") +
    (note ? tlv("62", tlv("08", transferNote(note))) : "") +
    "6304";
  return body + crc16(body);
}
