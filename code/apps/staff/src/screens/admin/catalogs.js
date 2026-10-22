import { REGION_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from "../../lib/format";

// Cau hinh 4 danh muc cho ResourceScreen - chuyen tu 4 trang web admin cu
// (apps/web/src/pages/*Page.jsx), giu nguyen endpoint va rang buoc field.

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

const STATUS_TONE = { ACTIVE: "success", LOCKED: "danger", PENDING: "warning" };

const isCustomer = (v) => v.role === "CUSTOMER";
const isBusiness = (v) => v.role === "CUSTOMER" && v.customerType === "BUSINESS";
const isHubStaff = (v) => v.role === "HUB_STAFF";
const isShipper = (v) => v.role === "SHIPPER";

const routeLabel = (route) => `${route.code} — ${route.name}`;

// Chua co API danh muc Hub (#14 · Sprint 3) nen tam nhap ObjectId.
const HUB_ID_HELP = "Nhập ObjectId của Hub (xem trong MongoDB Compass). Danh mục Hub có ở #14 · Sprint 3.";

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
    { name: "hubId", label: "Hub phụ trách (ObjectId)", required: true, showIf: isHubStaff, help: HUB_ID_HELP },
    shipperRoutesField,
  ],
  updateFields: [
    { name: "fullName", label: "Họ tên", required: true, autoCapitalize: "words" },
    { name: "role", label: "Vai trò", type: "select", required: true, options: ROLE_OPTIONS },
    { name: "status", label: "Trạng thái", type: "select", required: true, options: STATUS_OPTIONS },
    { name: "customerType", label: "Loại khách hàng", type: "select", options: CUSTOMER_TYPE_OPTIONS, showIf: isCustomer },
    { name: "shopName", label: "Tên cửa hàng", showIf: isBusiness, autoCapitalize: "words" },
    { name: "taxCode", label: "Mã số thuế", showIf: isBusiness },
    { name: "hubId", label: "Hub phụ trách (ObjectId)", showIf: isHubStaff, help: HUB_ID_HELP },
    shipperRoutesField,
    { name: "password", label: "Mật khẩu mới", type: "password", help: "Để trống nếu không đổi" },
  ],
};

const routeCapacityFields = [
  { name: "hubId", label: "Hub quản lý (ObjectId)", required: true, help: HUB_ID_HELP },
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

export const CATALOGS = { users, routes, serviceAreas, serviceTypes };
