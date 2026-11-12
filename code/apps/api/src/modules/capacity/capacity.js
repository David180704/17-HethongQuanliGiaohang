import { ErrorCodes } from "../../core/errors.js";

// Nang luc xu ly toi da moi ca (US-24) - ham thuan, mot nguon cho man hinh cau hinh va phan cong (US-25).
// Thu tu uu tien: rieng nguoi giao hang -> tuyen -> mac dinh he thong.
export const DEFAULT_CAPACITY = { maxPickupPerShift: 20, maxDeliveryPerShift: 30 };
export const CAPACITY_KINDS = { pickup: "maxPickupPerShift", delivery: "maxDeliveryPerShift" };
export const SOURCE_LABELS = { USER: "Riêng người giao hàng", ROUTE: "Theo tuyến", SYSTEM: "Mặc định hệ thống" };

const positive = (value) => Number.isInteger(value) && value > 0;

/**
 * @param {"pickup"|"delivery"} kind
 * @returns {{ value: number, source: "USER"|"ROUTE"|"SYSTEM" }}
 */
export function effectiveCapacity({ shipper = {}, route = {}, system = DEFAULT_CAPACITY }, kind) {
  const field = CAPACITY_KINDS[kind];
  if (!field) throw new Error(`Loai nang luc khong hop le: ${kind}`);
  if (positive(shipper[field])) return { value: shipper[field], source: "USER" };
  if (positive(route[field])) return { value: route[field], source: "ROUTE" };
  return { value: positive(system[field]) ? system[field] : DEFAULT_CAPACITY[field], source: "SYSTEM" };
}

/** Kiem tra gia tri cau hinh: so nguyen 1..500; cho phep null (= dung cap tren) khi allowNull. */
export function parseCapacityInput(body = {}, { allowNull = false } = {}) {
  const out = {};
  for (const field of Object.values(CAPACITY_KINDS)) {
    if (!(field in body)) continue;
    const raw = body[field];
    if ((raw === null || raw === "") && allowNull) {
      out[field] = null;
      continue;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 500) {
      throw ErrorCodes.VALIDATION_ERROR("Năng lực mỗi ca phải là số nguyên từ 1 đến 500");
    }
    out[field] = value;
  }
  return out;
}
