import RoleHome from "../RoleHome";

// Ma hang muc va Sprint lay tu sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
const HUB_TILES = [
  { key: "approve", title: "Duyệt đơn mới", description: "Xác nhận đơn, khóa phí vận chuyển", upcoming: "#18 · Sprint 3" },
  { key: "shifts", title: "Ca làm việc", description: "Xếp tài xế vào ca theo tuyến", upcoming: "#23 · Sprint 4" },
  { key: "assign", title: "Phân công lấy hàng", description: "Tự động theo tuyến và năng lực", upcoming: "#25 · Sprint 4" },
  { key: "incidents", title: "Sự cố, khiếu nại", description: "Ghi nhận và theo dõi xử lý", upcoming: "#38 · Sprint 6" },
];

export default function HubHome({ user, theme, onLogout }) {
  const hub = user.hubId;
  return (
    <RoleHome
      user={user}
      theme={theme}
      onLogout={onLogout}
      profileLines={[["Hub phụ trách", hub ? `${hub.name} (${hub.code})` : "Chưa được gán hub"]]}
      notice="Các chức năng vận hành của kho cần module đơn hàng (Sprint 3–4), đang được phát triển."
      sections={[{ title: "Công việc tại hub", tiles: HUB_TILES }]}
    />
  );
}
