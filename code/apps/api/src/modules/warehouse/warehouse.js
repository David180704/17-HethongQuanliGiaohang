// Quy trinh tai kho (US-41) - ham thuan: buoc tiep theo cua mot don voi nhan vien kho thuoc mot nhom hub
// (hub cua nhan vien + buu cuc truc thuoc). Thu tu: PICKED_UP -> AT_HUB (nhap kho) -> SORTED (phan loai)
// -> IN_TRANSIT (xuat kho len chang sau) -> AT_DEST_HUB (kho dich nhan).
import { ITEM_CATEGORY } from "../../constants/enums.js";

// Loai hang theo de 14 (goi nho, bao, thung, tivi, laptop, CPU, xe) - danh sach co dinh, khong lam man hinh quan tri
export const ITEM_CATEGORY_LABELS = {
  SMALL_PARCEL: "Gói nhỏ",
  BAG: "Bao",
  CARTON: "Thùng",
  TV: "Tivi",
  LAPTOP: "Laptop",
  CPU: "CPU / máy tính",
  VEHICLE: "Xe",
  OTHER: "Khác",
};

export const WAREHOUSE_ACTIONS = {
  RECEIVE: { label: "Nhận vào kho", to: "AT_HUB" },
  RECEIVE_DEST: { label: "Nhận tại kho đích", to: "AT_DEST_HUB" },
  SORT: { label: "Phân loại", to: "SORTED" },
  DISPATCH: { label: "Xuất kho", to: "IN_TRANSIT" },
};

const inFamily = (familyIds, id) => Boolean(id) && familyIds.some((f) => String(f) === String(id));

/** Kho dang giu hang; don cu (seed) chua co currentHubId thi coi la kho lay hang. */
export const currentHubOf = (order) =>
  order.currentHubId ?? (["AT_HUB", "SORTED"].includes(order.status) ? order.pickupHubId : null);

/**
 * Buoc tiep theo cua don voi nhan vien thuoc familyIds, kem ly do khi khong lam duoc.
 * @returns {{ action: keyof WAREHOUSE_ACTIONS | null, reason?: string }}
 */
export function nextWarehouseAction(order, familyIds, destHubId = order.destHubId) {
  switch (order.status) {
    case "PICKED_UP":
      return inFamily(familyIds, order.pickupHubId)
        ? { action: "RECEIVE" }
        : { action: null, reason: "Đơn được lấy về kho khác, không thuộc điểm của bạn" };
    case "IN_TRANSIT":
      return inFamily(familyIds, destHubId)
        ? { action: "RECEIVE_DEST" }
        : { action: null, reason: "Đơn đang trung chuyển tới kho khác" };
    case "AT_HUB":
    case "SORTED":
      if (!inFamily(familyIds, currentHubOf(order))) return { action: null, reason: "Hàng đang ở kho khác" };
      return { action: order.status === "AT_HUB" ? "SORT" : "DISPATCH" };
    default:
      return { action: null, reason: "Đơn không ở bước xử lý tại kho" };
  }
}

/** Phan loai: bat buoc chon loai hang trong danh sach co dinh. */
export function parseCategory(category) {
  return ITEM_CATEGORY.includes(category) ? category : null;
}
