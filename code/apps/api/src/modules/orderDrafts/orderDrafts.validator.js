import { Buffer } from "node:buffer";
import { ErrorCodes } from "../../core/errors.js";

// Ban nhap la du lieu dang go do cua form tao don (chua day du) nen khong kiem tung
// truong - tao don moi kiem day du. Chi chan: khong phai object, qua lon, va ten
// truong bat dau bang "$" (toan tu MongoDB) de khong lot vao CSDL.
export const MAX_DRAFT_BYTES = 20_000;

function assertSafeKeys(value, depth = 0) {
  if (depth > 6) throw ErrorCodes.VALIDATION_ERROR("Bản nháp lồng quá sâu");
  if (Array.isArray(value)) return value.forEach((entry) => assertSafeKeys(entry, depth + 1));
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) throw ErrorCodes.VALIDATION_ERROR(`Tên trường không hợp lệ: ${key}`);
      assertSafeKeys(entry, depth + 1);
    }
  }
  return undefined;
}

export function parseDraftPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw ErrorCodes.VALIDATION_ERROR("payload phải là object dữ liệu đơn đang nhập");
  }
  const json = JSON.stringify(payload);
  if (Buffer.byteLength(json, "utf8") > MAX_DRAFT_BYTES) throw ErrorCodes.VALIDATION_ERROR("Bản nháp quá lớn");
  assertSafeKeys(payload);
  return JSON.parse(json); // bo undefined, ham, Date -> chuoi: luu dung nhu client gui lai sau
}
