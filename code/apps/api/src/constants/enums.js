export const ROLES = ["GUEST", "CUSTOMER", "SHIPPER", "HUB_STAFF", "ADMIN"];

export const USER_STATUS = ["PENDING", "ACTIVE", "LOCKED"];

export const CUSTOMER_TYPE = ["INDIVIDUAL", "BUSINESS"];

// Hai san pham client tach theo doi tuong dung (CLAUDE.md muc 2): moi app chi
// cho dang nhap cac vai tro cua minh. GUEST khong co tai khoan nen khong nam o day.
export const APP_ROLES = {
  CUSTOMER: ["CUSTOMER"],
  STAFF: ["ADMIN", "HUB_STAFF", "SHIPPER"],
};

export const HUB_TYPE = ["HUB", "POST_OFFICE"];

export const REGION = ["BAC", "TRUNG", "NAM"];

export const SERVICE_TYPE_CODE = ["STANDARD", "EXPRESS"];

export const ZONE = ["INNER_DISTRICT", "INNER_PROVINCE", "INTER_PROVINCE", "INTER_REGION"];

export const FEE_PAYER = ["SHOP_PREPAID", "RECIPIENT_PAID", "DEDUCT_FROM_COD"];

export const FEE_PAYMENT_METHOD = ["QR", "CASH"];

export const COD_METHOD = ["CASH", "TRANSFER"];

// 18 trang thai thuc te trong vong doi don hang (xem CLAUDE.md muc 1 - nhan "17"
// trong tai lieu nhung liet ke ra 18 gia tri, da bao cho nguoi dung de xac nhan lai).
export const ORDER_STATUS = [
  "CREATED",
  "CONFIRMED",
  "PICKUP_ASSIGNED",
  "PICKED_UP",
  "SORTED",
  "IN_TRANSIT",
  "AT_HUB",
  "AT_DEST_HUB",
  "DELIVERY_ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PICKUP_FAILED",
  "DELIVERY_FAILED",
  "RESCHEDULED",
  "RETURNING",
  "RETURNED",
  "CANCELLED",
  "INCIDENT",
];

// Don da ket thuc vong doi - con lai deu la "chua hoan tat" (vd chan xoa dia diem lay hang, US-15)
export const FINISHED_ORDER_STATUS = ["DELIVERED", "RETURNED", "CANCELLED"];

export const PACKING_TYPE = ["BOX", "BAG", "PALLET", "ENVELOPE", "OTHER"];

// Kenh tao don va phuong tien goi y (US-40)
export const ORDER_CHANNEL = ["ONLINE", "COUNTER"];
export const VEHICLE_TYPE = ["MOTORBIKE", "TRUCK"];

export const ASSIGNMENT_TYPE = ["PICKUP", "DELIVERY", "RETURN"];

// CANCELLED: phan cong bi thay khi quan ly dieu chinh tay (US-25) - khong tinh vao nang luc ca
export const ASSIGNMENT_STATUS = ["ASSIGNED", "DONE", "FAILED", "CANCELLED"];

export const ASSIGNMENT_METHOD = ["AUTO", "MANUAL"];
