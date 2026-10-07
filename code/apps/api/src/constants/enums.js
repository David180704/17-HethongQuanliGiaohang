export const ROLES = ["GUEST", "CUSTOMER", "SHIPPER", "HUB_STAFF", "ADMIN"];

export const USER_STATUS = ["PENDING", "ACTIVE", "LOCKED"];

export const CUSTOMER_TYPE = ["INDIVIDUAL", "BUSINESS"];

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

export const PACKING_TYPE = ["BOX", "BAG", "PALLET", "ENVELOPE", "OTHER"];

export const ASSIGNMENT_TYPE = ["PICKUP", "DELIVERY", "RETURN"];

export const ASSIGNMENT_STATUS = ["ASSIGNED", "DONE", "FAILED"];

export const ASSIGNMENT_METHOD = ["AUTO", "MANUAL"];
