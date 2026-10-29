export const ROLE_LABELS = {
  GUEST: "Khách vãng lai",
  CUSTOMER: "Khách hàng",
  SHIPPER: "Tài xế giao nhận",
  HUB_STAFF: "Nhân viên kho",
  ADMIN: "Quản trị viên",
};

export const USER_STATUS_LABELS = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khóa",
  PENDING: "Chờ duyệt",
};

export const REGION_LABELS = {
  BAC: "Miền Bắc",
  TRUNG: "Miền Trung",
  NAM: "Miền Nam",
};

// Ten nguoi Viet: ten goi nam o tu cuoi ("Trần Minh Lan" -> "L").
export function avatarLetter(fullName = "") {
  const words = fullName.trim().split(" ").filter(Boolean);
  return (words[words.length - 1]?.[0] || "?").toUpperCase();
}

// "Khu vực phục vụ" -> "KV", "Hub & bưu cục" -> "HB" (bo ky hieu nhu "&")
export function tileInitials(title = "") {
  const isLetter = (ch) => ch.toUpperCase() !== ch.toLowerCase();
  return title
    .trim()
    .split(" ")
    .filter((word) => word && isLetter(word[0]))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
