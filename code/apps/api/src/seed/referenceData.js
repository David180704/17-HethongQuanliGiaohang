// Du lieu tham chieu tinh (vai tro, hub, tuyen, khu vuc, loai dich vu, bang gia).
// Dung _key noi bo de noi cac tham chieu voi nhau khi insert, khong luu vao DB.

export const roles = [
  {
    code: "GUEST",
    name: "Khách vãng lai",
    permissions: ["order:track", "priceTable:read", "serviceArea:read"],
    inheritsFrom: null,
  },
  {
    code: "CUSTOMER",
    name: "Khách hàng",
    permissions: [
      "order:create",
      "order:read:own",
      "order:cancel:own",
      "pickupLocation:manage:own",
      "profile:update:own",
    ],
    inheritsFrom: "GUEST",
  },
  {
    code: "SHIPPER",
    name: "Nhân viên giao nhận",
    permissions: ["order:read:assigned", "order:update:assigned", "checkin:create", "cod:collect"],
    inheritsFrom: null,
  },
  {
    code: "HUB_STAFF",
    name: "Nhân viên điểm/bưu cục",
    permissions: ["order:read:hub", "order:approve", "assignment:manage", "shift:manage"],
    inheritsFrom: null,
  },
  {
    code: "ADMIN",
    name: "Quản trị viên",
    permissions: ["*"],
    inheritsFrom: null,
  },
];

export const hubs = [
  { _key: "HUB_HN", code: "HUB-HN", name: "Hub Hà Nội", type: "HUB", province: "Hà Nội", district: "Hoàn Kiếm" },
  {
    _key: "HUB_HCM",
    code: "HUB-HCM",
    name: "Hub Hồ Chí Minh",
    type: "HUB",
    province: "TP Hồ Chí Minh",
    district: "Quận 1",
  },
  {
    _key: "PO_DN",
    code: "PO-DN",
    name: "Bưu cục Đà Nẵng",
    type: "POST_OFFICE",
    province: "Đà Nẵng",
    district: "Hải Châu",
  },
];

export const routes = [
  { _key: "R_HN_NOI", code: "R-HN-NOI", name: "Nội thành Hà Nội", hubKey: "HUB_HN", maxPickupPerShift: 25, maxDeliveryPerShift: 25 },
  { _key: "R_HN_LIEN", code: "R-HN-LIEN", name: "Liên tỉnh phía Bắc", hubKey: "HUB_HN", maxPickupPerShift: 20, maxDeliveryPerShift: 20 },
  { _key: "R_HCM_NOI", code: "R-HCM-NOI", name: "Nội thành Hồ Chí Minh", hubKey: "HUB_HCM", maxPickupPerShift: 25, maxDeliveryPerShift: 25 },
  { _key: "R_DN_NOI", code: "R-DN-NOI", name: "Nội thành Đà Nẵng", hubKey: "PO_DN", maxPickupPerShift: 15, maxDeliveryPerShift: 15 },
];

// Moi quan/huyen chi thuoc dung mot tuyen. region: BAC | TRUNG | NAM.
export const serviceAreas = [
  // BAC - noi thanh Ha Noi (R_HN_NOI)
  { province: "Hà Nội", district: "Hoàn Kiếm", region: "BAC", routeKey: "R_HN_NOI" },
  { province: "Hà Nội", district: "Đống Đa", region: "BAC", routeKey: "R_HN_NOI" },
  { province: "Hà Nội", district: "Cầu Giấy", region: "BAC", routeKey: "R_HN_NOI" },
  { province: "Hà Nội", district: "Hai Bà Trưng", region: "BAC", routeKey: "R_HN_NOI" },
  { province: "Hà Nội", district: "Hoàng Mai", region: "BAC", routeKey: "R_HN_NOI" },
  // BAC - lien tinh phia Bac (R_HN_LIEN)
  { province: "Bắc Ninh", district: "TP Bắc Ninh", region: "BAC", routeKey: "R_HN_LIEN" },
  { province: "Bắc Ninh", district: "Tiên Du", region: "BAC", routeKey: "R_HN_LIEN" },
  { province: "Hưng Yên", district: "TP Hưng Yên", region: "BAC", routeKey: "R_HN_LIEN" },
  { province: "Hưng Yên", district: "Văn Giang", region: "BAC", routeKey: "R_HN_LIEN" },
  { province: "Hải Phòng", district: "Hồng Bàng", region: "BAC", routeKey: "R_HN_LIEN" },
  { province: "Hải Phòng", district: "Lê Chân", region: "BAC", routeKey: "R_HN_LIEN" },
  // NAM - noi thanh Ho Chi Minh (R_HCM_NOI)
  { province: "TP Hồ Chí Minh", district: "Quận 1", region: "NAM", routeKey: "R_HCM_NOI" },
  { province: "TP Hồ Chí Minh", district: "Quận 3", region: "NAM", routeKey: "R_HCM_NOI" },
  { province: "TP Hồ Chí Minh", district: "Quận 7", region: "NAM", routeKey: "R_HCM_NOI" },
  { province: "TP Hồ Chí Minh", district: "Bình Thạnh", region: "NAM", routeKey: "R_HCM_NOI" },
  { province: "TP Hồ Chí Minh", district: "Tân Bình", region: "NAM", routeKey: "R_HCM_NOI" },
  { province: "Cần Thơ", district: "Ninh Kiều", region: "NAM", routeKey: "R_HCM_NOI" },
  // TRUNG - noi thanh Da Nang (R_DN_NOI)
  { province: "Đà Nẵng", district: "Hải Châu", region: "TRUNG", routeKey: "R_DN_NOI" },
  { province: "Đà Nẵng", district: "Thanh Khê", region: "TRUNG", routeKey: "R_DN_NOI" },
  { province: "Đà Nẵng", district: "Sơn Trà", region: "TRUNG", routeKey: "R_DN_NOI" },
];

export const serviceTypes = [
  { _key: "STANDARD", code: "STANDARD", name: "Giao hàng tiêu chuẩn", surchargeRate: 0, estimatedDays: 3 },
  { _key: "EXPRESS", code: "EXPRESS", name: "Giao hàng nhanh", surchargeRate: 0.5, estimatedDays: 1 },
];

// Quy uoc bac khoi luong: ap dung khi weight thuoc [fromGram, toGram) - tru bac
// cuoi dung toGram rat lon de coi nhu khong gioi han. Khong chong lan, khong ho.
// STANDARD va EXPRESS dung CHUNG mot bang gia theo zone (cung weightTiers);
// phan chenh lech gia cua EXPRESS hoan toan nam o serviceSurcharge (base x
// serviceType.surchargeRate), khong nhan doi vao base - xem ghi chu gui nguoi dung.
const tiersByZone = {
  INNER_DISTRICT: [
    { fromGram: 0, toGram: 500, basePrice: 15000, pricePer500g: 3000 },
    { fromGram: 500, toGram: 1000, basePrice: 18000, pricePer500g: 3000 },
    { fromGram: 1000, toGram: 2000, basePrice: 24000, pricePer500g: 3000 },
    { fromGram: 2000, toGram: 5000, basePrice: 33000, pricePer500g: 4000 },
    { fromGram: 5000, toGram: 999999999, basePrice: 45000, pricePer500g: 4000 },
  ],
  INNER_PROVINCE: [
    { fromGram: 0, toGram: 500, basePrice: 20000, pricePer500g: 4000 },
    { fromGram: 500, toGram: 1000, basePrice: 24000, pricePer500g: 4000 },
    { fromGram: 1000, toGram: 2000, basePrice: 32000, pricePer500g: 4000 },
    { fromGram: 2000, toGram: 5000, basePrice: 43000, pricePer500g: 5000 },
    { fromGram: 5000, toGram: 999999999, basePrice: 58000, pricePer500g: 5000 },
  ],
  INTER_PROVINCE: [
    { fromGram: 0, toGram: 500, basePrice: 28000, pricePer500g: 5000 },
    { fromGram: 500, toGram: 1000, basePrice: 34000, pricePer500g: 5000 },
    { fromGram: 1000, toGram: 2000, basePrice: 45000, pricePer500g: 5000 },
    { fromGram: 2000, toGram: 5000, basePrice: 60000, pricePer500g: 6000 },
    { fromGram: 5000, toGram: 999999999, basePrice: 80000, pricePer500g: 6000 },
  ],
  INTER_REGION: [
    { fromGram: 0, toGram: 500, basePrice: 38000, pricePer500g: 6000 },
    { fromGram: 500, toGram: 1000, basePrice: 46000, pricePer500g: 6000 },
    { fromGram: 1000, toGram: 2000, basePrice: 60000, pricePer500g: 6000 },
    { fromGram: 2000, toGram: 5000, basePrice: 80000, pricePer500g: 7000 },
    { fromGram: 5000, toGram: 999999999, basePrice: 105000, pricePer500g: 7000 },
  ],
};

export const ZONES = ["INNER_DISTRICT", "INNER_PROVINCE", "INTER_PROVINCE", "INTER_REGION"];

export function buildPriceTables() {
  const tables = [];
  for (const serviceTypeKey of ["STANDARD", "EXPRESS"]) {
    for (const zone of ZONES) {
      tables.push({
        serviceTypeKey,
        zone,
        weightTiers: tiersByZone[zone],
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: null,
        isActive: true,
      });
    }
  }
  return tables;
}
