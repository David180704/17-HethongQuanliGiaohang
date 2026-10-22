import ResourcePage from "../components/ResourcePage.jsx";

const ROLE_OPTIONS = [
  { value: "CUSTOMER", label: "Khách hàng" },
  { value: "SHIPPER", label: "Nhân viên giao nhận" },
  { value: "HUB_STAFF", label: "Nhân viên hub" },
  { value: "ADMIN", label: "Quản trị viên" },
];

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "LOCKED", label: "Đã khóa" },
];

const CUSTOMER_TYPE_OPTIONS = [
  { value: "INDIVIDUAL", label: "Cá nhân" },
  { value: "BUSINESS", label: "Doanh nghiệp" },
];

const isCustomer = (v) => v.role === "CUSTOMER";
const isBusiness = (v) => v.role === "CUSTOMER" && v.customerType === "BUSINESS";
const isHubStaff = (v) => v.role === "HUB_STAFF";

const HUB_ID_HELP = "Dán ObjectId của Hub (CRUD danh mục Hub sẽ có ở Sprint 3) — xem trong MongoDB Compass.";

const config = {
  title: "Người dùng",
  endpoint: "/users",
  searchPlaceholder: "Tìm theo email, số điện thoại, họ tên...",
  columns: [
    { key: "fullName", label: "Họ tên" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Điện thoại" },
    { key: "role", label: "Vai trò" },
    {
      key: "status",
      label: "Trạng thái",
      render: (item) => {
        const color =
          item.status === "ACTIVE" ? "bg-green-100 text-green-700"
          : item.status === "LOCKED" ? "bg-red-100 text-red-700"
          : "bg-yellow-100 text-yellow-700";
        return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{item.status}</span>;
      },
    },
  ],
  allowDelete: false,
  createFields: [
    { name: "fullName", label: "Họ tên", required: true },
    { name: "email", label: "Email", type: "text", required: true },
    { name: "phone", label: "Số điện thoại", required: true },
    { name: "password", label: "Mật khẩu", type: "password", required: true },
    { name: "role", label: "Vai trò", type: "select", required: true, options: ROLE_OPTIONS },
    { name: "customerType", label: "Loại khách hàng", type: "select", required: true, options: CUSTOMER_TYPE_OPTIONS, showIf: isCustomer },
    { name: "shopName", label: "Tên cửa hàng", showIf: isBusiness },
    { name: "taxCode", label: "Mã số thuế", showIf: isBusiness },
    { name: "hubId", label: "Hub phụ trách (ObjectId)", showIf: isHubStaff, help: HUB_ID_HELP },
  ],
  updateFields: [
    { name: "fullName", label: "Họ tên" },
    { name: "role", label: "Vai trò", type: "select", options: ROLE_OPTIONS },
    { name: "status", label: "Trạng thái", type: "select", options: STATUS_OPTIONS },
    { name: "customerType", label: "Loại khách hàng", type: "select", options: CUSTOMER_TYPE_OPTIONS, showIf: isCustomer },
    { name: "shopName", label: "Tên cửa hàng", showIf: isBusiness },
    { name: "taxCode", label: "Mã số thuế", showIf: isBusiness },
    { name: "hubId", label: "Hub phụ trách (ObjectId)", showIf: isHubStaff, help: HUB_ID_HELP },
    { name: "password", label: "Mật khẩu mới", type: "password", help: "Để trống nếu không đổi" },
  ],
};

export default function UsersPage() {
  return <ResourcePage config={config} />;
}
