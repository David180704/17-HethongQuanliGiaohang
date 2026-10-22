import ResourcePage from "../components/ResourcePage.jsx";

const REGION_OPTIONS = [
  { value: "BAC", label: "Miền Bắc" },
  { value: "TRUNG", label: "Miền Trung" },
  { value: "NAM", label: "Miền Nam" },
];

const routeIdField = {
  name: "routeId",
  label: "Tuyến phụ trách",
  type: "select",
  required: true,
  optionsFrom: { endpoint: "/routes", valueKey: "_id", labelKey: (r) => `${r.code} — ${r.name}` },
};

const config = {
  title: "Khu vực phục vụ",
  endpoint: "/serviceAreas",
  searchPlaceholder: "Tìm theo tỉnh, quận/huyện...",
  columns: [
    { key: "province", label: "Tỉnh/Thành" },
    { key: "district", label: "Quận/Huyện" },
    { key: "region", label: "Miền" },
  ],
  createFields: [
    { name: "province", label: "Tỉnh/Thành phố", required: true },
    { name: "district", label: "Quận/Huyện", required: true },
    { name: "region", label: "Miền", type: "select", required: true, options: REGION_OPTIONS },
    routeIdField,
  ],
  // province/district khong sua duoc sau khi tao (dung voi serviceAreas.schema.js)
  updateFields: [
    { name: "region", label: "Miền", type: "select", required: true, options: REGION_OPTIONS },
    routeIdField,
  ],
};

export default function ServiceAreasPage() {
  return <ResourcePage config={config} />;
}
