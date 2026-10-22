import ResourcePage from "../components/ResourcePage.jsx";

const HUB_ID_HELP = "Dán ObjectId của Hub (CRUD danh mục Hub sẽ có ở Sprint 3) — xem trong MongoDB Compass.";

const commonFields = [
  { name: "hubId", label: "Hub quản lý (ObjectId)", required: true, help: HUB_ID_HELP },
  { name: "maxPickupPerShift", label: "Năng lực lấy hàng / ca", type: "number", required: true },
  { name: "maxDeliveryPerShift", label: "Năng lực giao hàng / ca", type: "number", required: true },
  { name: "isActive", label: "Đang hoạt động", type: "checkbox" },
];

const config = {
  title: "Tuyến",
  endpoint: "/routes",
  searchPlaceholder: "Tìm theo mã, tên tuyến...",
  columns: [
    { key: "code", label: "Mã tuyến" },
    { key: "name", label: "Tên tuyến" },
    { key: "maxPickupPerShift", label: "NL lấy/ca" },
    { key: "maxDeliveryPerShift", label: "NL giao/ca" },
    { key: "isActive", label: "Hoạt động", render: (item) => (item.isActive ? "Có" : "Không") },
  ],
  createFields: [
    { name: "code", label: "Mã tuyến", required: true, placeholder: "R-HN-NOI" },
    { name: "name", label: "Tên tuyến", required: true },
    ...commonFields,
  ],
  updateFields: [{ name: "code", label: "Mã tuyến", required: true }, { name: "name", label: "Tên tuyến", required: true }, ...commonFields],
};

export default function RoutesPage() {
  return <ResourcePage config={config} />;
}
