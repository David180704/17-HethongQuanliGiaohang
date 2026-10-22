import ResourcePage from "../components/ResourcePage.jsx";

const CODE_OPTIONS = [
  { value: "STANDARD", label: "Gửi thường" },
  { value: "EXPRESS", label: "Gửi nhanh" },
];

const config = {
  title: "Loại dịch vụ",
  endpoint: "/serviceTypes",
  searchPlaceholder: "Tìm theo mã, tên loại dịch vụ...",
  columns: [
    { key: "code", label: "Mã" },
    { key: "name", label: "Tên" },
    { key: "surchargeRate", label: "Hệ số phụ phí" },
    { key: "estimatedDays", label: "Số ngày dự kiến" },
    { key: "isActive", label: "Hoạt động", render: (item) => (item.isActive ? "Có" : "Không") },
  ],
  createFields: [
    { name: "code", label: "Mã dịch vụ", type: "select", required: true, options: CODE_OPTIONS },
    { name: "name", label: "Tên hiển thị", required: true },
    { name: "surchargeRate", label: "Hệ số phụ phí (vd 0.5 = +50%)", type: "number", required: true },
    { name: "estimatedDays", label: "Số ngày dự kiến giao", type: "number", required: true },
    { name: "isActive", label: "Đang hoạt động", type: "checkbox" },
  ],
  // code khong sua duoc sau khi tao (dung voi serviceTypes.schema.js)
  updateFields: [
    { name: "name", label: "Tên hiển thị", required: true },
    { name: "surchargeRate", label: "Hệ số phụ phí (vd 0.5 = +50%)", type: "number", required: true },
    { name: "estimatedDays", label: "Số ngày dự kiến giao", type: "number", required: true },
    { name: "isActive", label: "Đang hoạt động", type: "checkbox" },
  ],
};

export default function ServiceTypesPage() {
  return <ResourcePage config={config} />;
}
