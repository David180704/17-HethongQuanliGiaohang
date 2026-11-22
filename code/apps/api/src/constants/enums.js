export const ROLES = ["GUEST", "CUSTOMER", "SHIPPER", "HUB_STAFF", "ADMIN"];

export const USER_STATUS = ["PENDING", "ACTIVE", "LOCKED"];

export const CUSTOMER_TYPE = ["INDIVIDUAL", "BUSINESS"];

// Hai san pham client tach theo doi tuong dung (tai lieu kien truc, docs/KienTrucAPI.md): moi app chi
// cho dang nhap cac vai tro cua minh. GUEST khong co tai khoan nen khong nam o day.
export const APP_ROLES = {
  CUSTOMER: ["CUSTOMER"],
  STAFF: ["ADMIN", "HUB_STAFF", "SHIPPER"],
};

export const HUB_TYPE = ["HUB", "POST_OFFICE"];

export const REGION = ["BAC", "TRUNG", "NAM"];

export const SERVICE_TYPE_CODE = ["STANDARD", "EXPRESS"];

export const ZONE = ["INNER_WARD", "INNER_PROVINCE", "INTER_PROVINCE", "INTER_REGION"];

export const FEE_PAYER = ["SHOP_PREPAID", "RECIPIENT_PAID", "DEDUCT_FROM_COD"];

// VNPAY: tra truoc online qua cong VNPay (US-44); QR: chuyen khoan tu xac nhan (don cu, giao dien khong con chon)
export const FEE_PAYMENT_METHOD = ["VNPAY", "CASH", "QR"];

// Giao dich thanh toan phi van chuyen (US-44): cho thanh toan, thanh cong, that bai / huy
export const PAYMENT_STATUS = ["PENDING", "SUCCESS", "FAILED"];
export const PAYMENT_PROVIDER = ["VNPAY"];
// Ung dung mo trang thanh toan - quyet dinh tra nguoi dung ve dau sau khi VNPay xu ly xong
export const PAYMENT_CLIENT = ["WEB", "MOBILE"];

export const COD_METHOD = ["CASH", "TRANSFER"];

// 18 trang thai thuc te trong vong doi don hang (tai lieu yeu cau ghi "17"
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

// Loai hang khi phan loai tai kho (US-41) - danh sach co dinh theo de 14 (goi nho, bao, thung, tivi, laptop, CPU, xe)
export const ITEM_CATEGORY = ["SMALL_PARCEL", "BAG", "CARTON", "TV", "LAPTOP", "CPU", "VEHICLE", "OTHER"];

// Nguyen nhan khong lay duoc hang (US-28, PB#34)
export const PICKUP_FAIL_REASON = ["SHOP_UNREACHABLE", "NOT_READY", "WRONG_ADDRESS", "NOT_AS_DESCRIBED", "SHOP_CANCELLED", "OTHER"];

// Nguyen nhan giao khong thanh cong (US-32, PB#40) - de 02: khong lien he duoc, hen giao lai, tu choi, sai dia chi
export const DELIVERY_FAIL_REASON = ["RECIPIENT_UNREACHABLE", "RESCHEDULE_REQUESTED", "REFUSED", "WRONG_ADDRESS", "RECIPIENT_ABSENT", "OTHER"];

// Su co, khieu nai (US-38, de 02): that lac, hu hong, sai thong tin giao nhan, khieu nai cua shop / nguoi nhan
export const INCIDENT_TYPE = ["LOST", "DAMAGED", "WRONG_INFO", "SHOP_COMPLAINT", "RECIPIENT_COMPLAINT", "OTHER"];
export const INCIDENT_STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED"];
// Ai bao: shop (khach tu bao tren app), nguoi nhan (bao qua tong dai, nhan vien ghi), nhan vien (kho, tai xe)
export const INCIDENT_SOURCE = ["SHOP", "RECIPIENT", "STAFF"];

// Nguon check-in (US-30): tu dong khi di qua diem, hoac tai xe bam tay
export const CHECKIN_SOURCE = ["AUTO", "MANUAL"];
// Toa do lay tu dau (22/11/2026): GPS that cua dien thoai / trinh duyet, hay vi tri gia lap (may ao, kiem thu)
export const POSITION_SOURCE = ["GPS", "SIMULATED"];

// Kenh tao don va phuong tien goi y (US-40)
export const ORDER_CHANNEL = ["ONLINE", "COUNTER"];
export const VEHICLE_TYPE = ["MOTORBIKE", "TRUCK"];

export const ASSIGNMENT_TYPE = ["PICKUP", "DELIVERY", "RETURN"];

// CANCELLED: phan cong bi thay khi quan ly dieu chinh tay (US-25) - khong tinh vao nang luc ca
export const ASSIGNMENT_STATUS = ["ASSIGNED", "DONE", "FAILED", "CANCELLED"];

export const ASSIGNMENT_METHOD = ["AUTO", "MANUAL"];
