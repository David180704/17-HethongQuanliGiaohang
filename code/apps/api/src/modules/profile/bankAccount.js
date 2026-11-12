import { ErrorCodes } from "../../core/errors.js";

// Ngan hang nhan tien thu ho (US-42, PB#12) - danh sach co dinh cac ngan hang pho bien (ma theo chuan VietQR)
export const BANKS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "CTG", name: "VietinBank" },
  { code: "BIDV", name: "BIDV" },
  { code: "AGR", name: "Agribank" },
  { code: "TCB", name: "Techcombank" },
  { code: "MB", name: "MB Bank" },
  { code: "ACB", name: "ACB" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "VIB", name: "VIB" },
  { code: "SHB", name: "SHB" },
  { code: "HDB", name: "HDBank" },
  { code: "OCB", name: "OCB" },
  { code: "MSB", name: "MSB" },
];

/** "Nguyễn Văn Đức" -> "NGUYEN VAN DUC" (ten chu tai khoan ngan hang in khong dau). */
export function toAccountName(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Kiem tra tai khoan nhan thu ho: ngan hang trong danh sach, so tai khoan 6-19 chu so, ten chu tai khoan. */
export function parseBankAccount(input = {}) {
  const bank = BANKS.find((b) => b.code === input.bankCode || b.name === input.bankName);
  if (!bank) throw ErrorCodes.VALIDATION_ERROR("Chọn ngân hàng nhận tiền thu hộ");
  const accountNumber = String(input.accountNumber || "").replace(/[\s.-]/g, "");
  if (!/^\d{6,19}$/.test(accountNumber)) throw ErrorCodes.VALIDATION_ERROR("Số tài khoản gồm 6 đến 19 chữ số");
  const accountName = toAccountName(input.accountName);
  if (!/^[A-Z ]{3,50}$/.test(accountName)) {
    throw ErrorCodes.VALIDATION_ERROR("Tên chủ tài khoản 3–50 chữ cái, ghi đúng như trên thẻ ngân hàng");
  }
  return { bankName: bank.name, bankCode: bank.code, accountNumber, accountName };
}
