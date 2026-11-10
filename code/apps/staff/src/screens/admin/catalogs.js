import { REGION_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from "../../lib/format";

// Cau hinh danh muc cho ResourceScreen - 4 danh muc dau chuyen tu trang web admin
// cu (apps/web/src/pages/*Page.jsx), giu nguyen endpoint va rang buoc field.

const toOptions = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

const ROLE_OPTIONS = toOptions({
  CUSTOMER: ROLE_LABELS.CUSTOMER,
  SHIPPER: ROLE_LABELS.SHIPPER,
  HUB_STAFF: ROLE_LABELS.HUB_STAFF,
  ADMIN: ROLE_LABELS.ADMIN,
});
const STATUS_OPTIONS = toOptions(USER_STATUS_LABELS);
const CUSTOMER_TYPE_OPTIONS = toOptions({ INDIVIDUAL: "Cá nhân", BUSINESS: "Doanh nghiệp" });
const REGION_OPTIONS = toOptions(REGION_LABELS);
const SERVICE_CODE_OPTIONS = toOptions({ STANDARD: "Gửi thường", EXPRESS: "Gửi nhanh" });
const ZONE_LABELS = {
  INNER_DISTRICT: "Nội quận",
  INNER_PROVINCE: "Nội tỉnh",
  INTER_PROVINCE: "Liên tỉnh",
  INTER_REGION: "Liên miền",
};
const ZONE_OPTIONS = toOptions(ZONE_LABELS);
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("vi-VN") : "Không thời hạn");

const STATUS_TONE = { ACTIVE: "success", LOCKED: "danger", PENDING: "warning" };

const isCustomer = (v) => v.role === "CUSTOMER";
const isBusiness = (v) => v.role === "CUSTOMER" && v.customerType === "BUSINESS";
const isHubStaff = (v) => v.role === "HUB_STAFF";
const isShipper = (v) => v.role === "SHIPPER";

const routeLabel = (route) => `${route.code} — ${route.name}`;
const hubLabel = (hub) => `${hub.code} — ${hub.name}`;

// Chon hub tu danh muc Hub & buu cuc (US-14) thay cho go tay ObjectId
const hubSelect = (overrides) => ({
  name: "hubId",
  type: "select",
  optionsFrom: { endpoint: "/hubs", label: hubLabel },
  ...overrides,
});

const shipperRoutesField = {
  name: "routeIds",
  label: "Tuyến phụ trách",
  type: "multiselect",
  optionsFrom: { endpoint: "/routes", label: routeLabel },
  showIf: isShipper,
  help: "Tài xế chỉ được phân công đơn thuộc các tuyến này.",
};

const users = {
  title: "Người dùng",
  endpoint: "/users",
  searchPlaceholder: "Tìm theo email, số điện thoại, họ tên...",
  allowDelete: false,
  columns: [
    { key: "fullName", label: "Họ tên" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Điện thoại" },
    { key: "role", label: "Vai trò", format: (item) => ROLE_LABELS[item.role] || item.role },
    {
      key: "status",
      label: "Trạng thái",
      format: (item) => USER_STATUS_LABELS[item.status] || item.status,
      badge: (item) => STATUS_TONE[item.status] || "neutral",
    },
  ],
  createFields: [
    { name: "fullName", label: "Họ tên", required: true, autoCapitalize: "words" },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Số điện thoại", type: "phone", required: true },
    { name: "password", label: "Mật khẩu", type: "password", required: true },
    { name: "role", label: "Vai trò", type: "select", required: true, options: ROLE_OPTIONS },
    {
      name: "customerType",
      label: "Loại khách hàng",
      type: "select",
      required: true,
      options: CUSTOMER_TYPE_OPTIONS,
      showIf: isCustomer,
    },
    { name: "shopName", label: "Tên cửa hàng", required: true, showIf: isBusiness, autoCapitalize: "words" },
    { name: "taxCode", label: "Mã số thuế", required: true, showIf: isBusiness },
    hubSelect({ label: "Hub phụ trách", required: true, showIf: isHubStaff }),
    shipperRoutesField,
  ],
  updateFields: [
    { name: "fullName", label: "Họ tên", required: true, autoCapitalize: "words" },
    { name: "role", label: "Vai trò", type: "select", required: true, options: ROLE_OPTIONS },
    { name: "status", label: "Trạng thái", type: "select", required: true, options: STATUS_OPTIONS },
    { name: "customerType", label: "Loại khách hàng", type: "select", options: CUSTOMER_TYPE_OPTIONS, showIf: isCustomer },
    { name: "shopName", label: "Tên cửa hàng", showIf: isBusiness, autoCapitalize: "words" },
    { name: "taxCode", label: "Mã số thuế", showIf: isBusiness },
    hubSelect({ label: "Hub phụ trách", showIf: isHubStaff }),
    shipperRoutesField,
    { name: "password", label: "Mật khẩu mới", type: "password", help: "Để trống nếu không đổi" },
  ],
};

const routeCapacityFields = [
  hubSelect({ label: "Hub / bưu cục quản lý", required: true, help: "Điểm tập kết hoặc bưu cục phụ trách tuyến." }),
  { name: "maxPickupPerShift", label: "Năng lực lấy hàng / ca", type: "number", required: true },
  { name: "maxDeliveryPerShift", label: "Năng lực giao hàng / ca", type: "number", required: true },
  { name: "isActive", label: "Đang hoạt động", type: "checkbox", defaultValue: true },
];

const routes = {
  title: "Tuyến",
  endpoint: "/routes",
  searchPlaceholder: "Tìm theo mã, tên tuyến...",
  columns: [
    { key: "name", label: "Tên tuyến" },
    { key: "code", label: "Mã tuyến" },
    { key: "maxPickupPerShift", label: "Năng lực lấy / ca" },
    { key: "maxDeliveryPerShift", label: "Năng lực giao / ca" },
    { key: "isActive", label: "Hoạt động" },
  ],
  createFields: [
    { name: "code", label: "Mã tuyến", required: true, placeholder: "R-HN-NOI", autoCapitalize: "characters" },
    { name: "name", label: "Tên tuyến", required: true, autoCapitalize: "sentences" },
    ...routeCapacityFields,
  ],
  updateFields: [
    { name: "code", label: "Mã tuyến", required: true, autoCapitalize: "characters" },
    { name: "name", label: "Tên tuyến", required: true, autoCapitalize: "sentences" },
    ...routeCapacityFields,
  ],
};

const routeIdField = {
  name: "routeId",
  label: "Tuyến phụ trách",
  type: "select",
  required: true,
  optionsFrom: { endpoint: "/routes", label: routeLabel },
  help: "Một quận/huyện chỉ thuộc đúng một tuyến.",
};

const serviceAreas = {
  title: "Khu vực phục vụ",
  endpoint: "/serviceAreas",
  searchPlaceholder: "Tìm theo tỉnh, quận/huyện...",
  columns: [
    { key: "district", label: "Quận/Huyện" },
    { key: "province", label: "Tỉnh/Thành" },
    { key: "region", label: "Miền", format: (item) => REGION_LABELS[item.region] || item.region },
  ],
  createFields: [
    { name: "province", label: "Tỉnh/Thành phố", required: true, autoCapitalize: "words" },
    { name: "district", label: "Quận/Huyện", required: true, autoCapitalize: "words" },
    { name: "region", label: "Miền", type: "select", required: true, options: REGION_OPTIONS },
    routeIdField,
  ],
  // province/district khong sua sau khi tao (dung voi serviceAreas.schema.js)
  updateFields: [{ name: "region", label: "Miền", type: "select", required: true, options: REGION_OPTIONS }, routeIdField],
};

const serviceTypeFields = [
  { name: "name", label: "Tên hiển thị", required: true, autoCapitalize: "sentences" },
  {
    name: "surchargeRate",
    label: "Hệ số phụ phí",
    type: "number",
    required: true,
    help: "0.5 nghĩa là cộng thêm 50% cước cơ bản",
  },
  { name: "estimatedDays", label: "Số ngày giao dự kiến", type: "number", required: true },
  { name: "isActive", label: "Đang hoạt động", type: "checkbox", defaultValue: true },
];

const serviceTypes = {
  title: "Loại dịch vụ",
  endpoint: "/serviceTypes",
  searchPlaceholder: "Tìm theo mã, tên loại dịch vụ...",
  columns: [
    { key: "name", label: "Tên" },
    { key: "code", label: "Mã" },
    { key: "surchargeRate", label: "Hệ số phụ phí" },
    { key: "estimatedDays", label: "Số ngày dự kiến" },
    { key: "isActive", label: "Hoạt động" },
  ],
  createFields: [
    { name: "code", label: "Mã dịch vụ", type: "select", required: true, options: SERVICE_CODE_OPTIONS },
    ...serviceTypeFields,
  ],
  // code khong sua sau khi tao (dung voi serviceTypes.schema.js)
  updateFields: serviceTypeFields,
};

// Diem tap ket va buu cuc (US-14): buu cuc truc thuoc mot hub; quan/huyen phai
// thuoc vung phuc vu (server tu gan khu vuc phuc vu, bao loi neu ngoai vung).
const HUB_TYPE_LABELS = { HUB: "Hub — điểm tập kết", POST_OFFICE: "Bưu cục" };
const isPostOffice = (v) => v.type === "POST_OFFICE";

const hubTypeField = {
  name: "type",
  label: "Loại điểm",
  type: "select",
  required: true,
  options: toOptions(HUB_TYPE_LABELS),
};
const parentHubField = {
  name: "parentHubId",
  label: "Trực thuộc hub",
  type: "select",
  required: true,
  optionsFrom: { endpoint: "/hubs", params: { type: "HUB" }, label: hubLabel },
  showIf: isPostOffice,
  help: "Bưu cục gom hàng về hub này trước khi trung chuyển đi nơi khác.",
};
const hubPlaceFields = [
  { name: "address", label: "Địa chỉ", autoCapitalize: "sentences" },
  { name: "province", label: "Tỉnh/Thành phố", required: true, autoCapitalize: "words" },
  {
    name: "district",
    label: "Quận/Huyện",
    required: true,
    autoCapitalize: "words",
    help: "Phải thuộc vùng phục vụ — hệ thống tự gắn khu vực phục vụ.",
  },
  { name: "isActive", label: "Đang hoạt động", type: "checkbox", defaultValue: true },
];
const hubNameField = { name: "name", label: "Tên điểm", required: true, autoCapitalize: "sentences" };

const hubs = {
  title: "Hub & bưu cục",
  endpoint: "/hubs",
  searchPlaceholder: "Tìm theo mã, tên, tỉnh, quận/huyện...",
  columns: [
    { key: "name", label: "Tên" },
    { key: "code", label: "Mã" },
    {
      key: "type",
      label: "Loại",
      format: (item) => HUB_TYPE_LABELS[item.type] || item.type,
      badge: (item) => (item.type === "HUB" ? "info" : "neutral"),
    },
    { key: "parentHubId", label: "Trực thuộc", format: (item) => (item.parentHubId ? hubLabel(item.parentHubId) : "—") },
    { key: "district", label: "Khu vực", format: (item) => `${item.district}, ${item.province}` },
    { key: "isActive", label: "Hoạt động" },
  ],
  createFields: [
    { name: "code", label: "Mã điểm", required: true, placeholder: "PO-HN-CG", autoCapitalize: "characters" },
    hubNameField,
    hubTypeField,
    parentHubField,
    ...hubPlaceFields,
  ],
  // Ma diem khong sua sau khi tao (dung voi hubs.validator.js)
  updateFields: [hubNameField, hubTypeField, parentHubField, ...hubPlaceFields],
};

const TIERS_HELP =
  "Bậc áp dụng khi Từ ≤ khối lượng < Đến; bậc đầu từ 0 g, các bậc nối tiếp nhau, bậc cuối đặt Đến rất lớn (vd 999999999).";

// Bang gia (US-13): bang gia da dung cho don hang chi lui duoc ngay het hieu luc (server kiem).
const priceTables = {
  title: "Bảng giá",
  endpoint: "/priceTables",
  searchPlaceholder: "Bảng giá theo dịch vụ và vùng",
  columns: [
    {
      key: "zone",
      label: "Vùng",
      format: (item) => `${ZONE_LABELS[item.zone] || item.zone} · ${item.serviceTypeId?.name || "—"}`,
    },
    { key: "effectiveFrom", label: "Hiệu lực từ", format: (item) => formatDate(item.effectiveFrom) },
    { key: "effectiveTo", label: "Đến", format: (item) => formatDate(item.effectiveTo) },
    {
      key: "weightTiers",
      label: "Bậc khối lượng",
      format: (item) => `${item.weightTiers?.length || 0} bậc, từ ${item.weightTiers?.[0]?.basePrice?.toLocaleString("vi-VN") ?? "—"} ₫`,
    },
    { key: "isActive", label: "Hoạt động" },
  ],
  createFields: [
    {
      name: "serviceTypeId",
      label: "Loại dịch vụ",
      type: "select",
      required: true,
      optionsFrom: { endpoint: "/serviceTypes", label: (s) => s.name },
    },
    { name: "zone", label: "Vùng", type: "select", required: true, options: ZONE_OPTIONS },
    { name: "effectiveFrom", label: "Hiệu lực từ ngày", type: "date", required: true },
    { name: "effectiveTo", label: "Hết hiệu lực ngày", type: "date", help: "Để trống nếu không thời hạn" },
    { name: "weightTiers", label: "Bậc khối lượng", type: "tiers", required: true, help: TIERS_HELP },
    { name: "isActive", label: "Đang hoạt động", type: "checkbox", defaultValue: true },
  ],
  // Dich vu va vung khong doi sau khi tao (doi = tao bang gia moi)
  updateFields: [
    { name: "effectiveFrom", label: "Hiệu lực từ ngày", type: "date", required: true },
    {
      name: "effectiveTo",
      label: "Hết hiệu lực ngày",
      type: "date",
      help: "Bảng giá đã dùng cho đơn hàng chỉ được lùi ngày này, không sửa bậc.",
    },
    { name: "weightTiers", label: "Bậc khối lượng", type: "tiers", required: true, help: TIERS_HELP },
    { name: "isActive", label: "Đang hoạt động", type: "checkbox", defaultValue: true },
  ],
};

// US-29: diem check-in - toa do (vi do, kinh do) va ban kinh; tai xe di qua trong ban kinh thi tu ghi moc hanh trinh
const checkinPointFields = [
  { name: "code", label: "Mã điểm", required: true, placeholder: "CP-HN-01", autoCapitalize: "characters" },
  { name: "name", label: "Tên điểm", required: true, autoCapitalize: "sentences" },
  { name: "address", label: "Địa chỉ / mô tả", autoCapitalize: "sentences" },
  { name: "lat", label: "Vĩ độ (lat)", type: "number", required: true, placeholder: "21.0285" },
  { name: "lng", label: "Kinh độ (lng)", type: "number", required: true, placeholder: "105.8542" },
  { name: "radiusM", label: "Bán kính (m)", type: "number", defaultValue: "150", help: "Mặc định 150 m, từ 20 đến 2000 m." },
  hubSelect({ label: "Hub gần nhất (tuỳ chọn)" }),
  { name: "isActive", label: "Đang dùng", type: "checkbox", defaultValue: true },
];

const checkinPoints = {
  title: "Điểm check-in",
  endpoint: "/checkinPoints",
  searchPlaceholder: "Tìm theo mã, tên điểm...",
  columns: [
    { key: "name", label: "Tên điểm" },
    { key: "code", label: "Mã điểm" },
    { key: "lat", label: "Tọa độ", format: (item) => `${item.lat}, ${item.lng}` },
    { key: "radiusM", label: "Bán kính", format: (item) => `${item.radiusM} m` },
    { key: "isActive", label: "Đang dùng" },
  ],
  createFields: checkinPointFields,
  updateFields: checkinPointFields,
};

export const CATALOGS = { users, hubs, routes, serviceAreas, serviceTypes, priceTables, checkinPoints };
