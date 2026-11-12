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

// HUB = diem tap ket cap tinh/vung; POST_OFFICE = buu cuc, truc thuoc mot HUB (parentKey).
// Hub cap tren phai dung TRUOC buu cuc trong mang (seed tao lan luot). Xa/phuong cua
// moi diem phai co trong serviceAreas ben duoi (US-14: moi diem gan mot khu vuc phuc vu).
export const hubs = [
  { _key: "HUB_HN", code: "HUB-HN", name: "Hub Hà Nội", type: "HUB", province: "Hà Nội", ward: "Phường Hoàn Kiếm" },
  {
    _key: "HUB_HCM",
    code: "HUB-HCM",
    name: "Hub Hồ Chí Minh",
    type: "HUB",
    province: "TP Hồ Chí Minh",
    ward: "Phường Sài Gòn",
  },
  {
    _key: "PO_DN",
    code: "PO-DN",
    name: "Bưu cục Đà Nẵng",
    type: "POST_OFFICE",
    // Mien Trung chua co hub rieng: buu cuc Da Nang gom hang ve Hub Ha Noi
    parentKey: "HUB_HN",
    province: "Đà Nẵng",
    ward: "Phường Hải Châu",
  },
];

// Diem check-in mau (US-29): toa do that gan dung, ban kinh mac dinh 150 m; tai xe chon "dang o" diem nay tren app
export const checkinPoints = [
  { code: "CP-HN-HUB", name: "Hub Hà Nội", address: "Phường Hoàn Kiếm, Hà Nội", lat: 21.0285, lng: 105.8542, hubKey: "HUB_HN" },
  { code: "CP-HN-CG", name: "Ngã tư Xuân Thủy – Cầu Giấy", address: "Phường Cầu Giấy, Hà Nội", lat: 21.0368, lng: 105.7826, hubKey: "HUB_HN" },
  { code: "CP-QL1-NB", name: "Trạm QL1A Ninh Bình", address: "Ninh Bình", lat: 20.2506, lng: 105.9745, radiusM: 300 },
  { code: "CP-DN-PO", name: "Bưu cục Đà Nẵng", address: "Phường Hải Châu, Đà Nẵng", lat: 16.0678, lng: 108.2208, hubKey: "PO_DN" },
  { code: "CP-HCM-HUB", name: "Hub Hồ Chí Minh", address: "Phường Sài Gòn, TP Hồ Chí Minh", lat: 10.7769, lng: 106.7009, hubKey: "HUB_HCM" },
];

export const routes = [
  { _key: "R_HN_NOI", code: "R-HN-NOI", name: "Nội thành Hà Nội", hubKey: "HUB_HN", maxPickupPerShift: 25, maxDeliveryPerShift: 25 },
  { _key: "R_HN_LIEN", code: "R-HN-LIEN", name: "Liên tỉnh phía Bắc", hubKey: "HUB_HN", maxPickupPerShift: 20, maxDeliveryPerShift: 20 },
  { _key: "R_HCM_NOI", code: "R-HCM-NOI", name: "Nội thành Hồ Chí Minh", hubKey: "HUB_HCM", maxPickupPerShift: 25, maxDeliveryPerShift: 25 },
  { _key: "R_DN_NOI", code: "R-DN-NOI", name: "Nội thành Đà Nẵng", hubKey: "PO_DN", maxPickupPerShift: 15, maxDeliveryPerShift: 15 },
  { _key: "R_HCM_LIEN", code: "R-HCM-LIEN", name: "Liên tỉnh phía Nam", hubKey: "HUB_HCM", maxPickupPerShift: 20, maxDeliveryPerShift: 20 },
  { _key: "R_DN_LIEN", code: "R-DN-LIEN", name: "Liên tỉnh miền Trung", hubKey: "PO_DN", maxPickupPerShift: 15, maxDeliveryPerShift: 15 },
];

// Mien cua 34 tinh/thanh (dia gioi tu 01/07/2025) - dung tinh gia lien tinh / lien mien.
export const PROVINCE_REGION = {
  BAC: ["Hà Nội", "Cao Bằng", "Tuyên Quang", "Điện Biên", "Lai Châu", "Sơn La", "Lào Cai", "Thái Nguyên", "Lạng Sơn",
    "Quảng Ninh", "Bắc Ninh", "Phú Thọ", "Hải Phòng", "Hưng Yên", "Ninh Bình"],
  TRUNG: ["Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Trị", "Huế", "Đà Nẵng", "Quảng Ngãi", "Gia Lai", "Khánh Hòa",
    "Đắk Lắk", "Lâm Đồng"],
  NAM: ["Đồng Nai", "TP Hồ Chí Minh", "Tây Ninh", "Đồng Tháp", "Vĩnh Long", "An Giang", "Cần Thơ", "Cà Mau"],
};

// Tuyen phu trach theo tinh: noi thanh 3 thanh pho lon (Can Tho giu tuyen noi thanh HCM nhu truoc),
// con lai di tuyen lien tinh cua mien.
const NOI_THANH = { "Hà Nội": "R_HN_NOI", "TP Hồ Chí Minh": "R_HCM_NOI", "Cần Thơ": "R_HCM_NOI", "Đà Nẵng": "R_DN_NOI" };
const LIEN_TINH = { BAC: "R_HN_LIEN", TRUNG: "R_DN_LIEN", NAM: "R_HCM_LIEN" };

/** Khu vuc phuc vu = moi xa/phuong cua ca 34 tinh/thanh (3.321), moi xa/phuong mot tuyen. */
export function buildServiceAreas(provinces) {
  return provinces.flatMap((p) => {
    const region = Object.keys(PROVINCE_REGION).find((r) => PROVINCE_REGION[r].includes(p.name));
    if (!region) throw new Error(`Chua xep mien cho ${p.name}`);
    const routeKey = NOI_THANH[p.name] || LIEN_TINH[region];
    return p.wards.map((ward) => ({ province: p.name, ward, region, routeKey }));
  });
}

// 20 xa/phuong dai dien (thay 20 quan/huyen cu, cung thu tu) - seed boc ngau nhien dia diem lay hang va
// nguoi nhan tu day nen 200 don mau giu nguyen phan bo tuyen / vung gia nhu truoc khi bo cap quan/huyen.
export const sampleWards = [
  { province: "Hà Nội", ward: "Phường Hoàn Kiếm" },
  { province: "Hà Nội", ward: "Phường Đống Đa" },
  { province: "Hà Nội", ward: "Phường Cầu Giấy" },
  { province: "Hà Nội", ward: "Phường Hai Bà Trưng" },
  { province: "Hà Nội", ward: "Phường Hoàng Mai" },
  { province: "Bắc Ninh", ward: "Phường Kinh Bắc" },
  { province: "Bắc Ninh", ward: "Xã Tiên Du" },
  { province: "Hưng Yên", ward: "Phường Phố Hiến" },
  { province: "Hưng Yên", ward: "Xã Văn Giang" },
  { province: "Hải Phòng", ward: "Phường Hồng Bàng" },
  { province: "Hải Phòng", ward: "Phường Lê Chân" },
  { province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
  { province: "TP Hồ Chí Minh", ward: "Phường Xuân Hòa" },
  { province: "TP Hồ Chí Minh", ward: "Phường Tân Mỹ" },
  { province: "TP Hồ Chí Minh", ward: "Phường Bình Thạnh" },
  { province: "TP Hồ Chí Minh", ward: "Phường Tân Bình" },
  { province: "Cần Thơ", ward: "Phường Ninh Kiều" },
  { province: "Đà Nẵng", ward: "Phường Hải Châu" },
  { province: "Đà Nẵng", ward: "Phường Thanh Khê" },
  { province: "Đà Nẵng", ward: "Phường Sơn Trà" },
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
  INNER_WARD: [
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

export const ZONES = ["INNER_WARD", "INNER_PROVINCE", "INTER_PROVINCE", "INTER_REGION"];

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
