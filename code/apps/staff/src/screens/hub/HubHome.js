import { useEffect, useState } from "react";
import RoleHome from "../RoleHome";
import { queryCache } from "../../lib/queryCache";

// Ma hang muc va Sprint lay tu sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
const UPCOMING_TILES = [
  { key: "shifts", title: "Ca làm việc", description: "Xếp tài xế vào ca theo tuyến", upcoming: "#23 · Sprint 4" },
  { key: "assign", title: "Phân công lấy hàng", description: "Tự động theo tuyến và năng lực", upcoming: "#25 · Sprint 4" },
  { key: "incidents", title: "Sự cố, khiếu nại", description: "Ghi nhận và theo dõi xử lý", upcoming: "#38 · Sprint 6" },
];

export default function HubHome({ user, theme, onLogout, onOpenApprove, onOpenCounter }) {
  const hub = user.hubId;
  const [waiting, setWaiting] = useState();

  // So don cho duyet that (limit=1, chi lay meta.total), qua cache 30 giay
  useEffect(() => {
    let cancelled = false;
    queryCache
      .get("/orders", { status: "CREATED", limit: 1 })
      .then(({ body }) => !cancelled && setWaiting(body.meta.total))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const workTiles = [
    {
      key: "counter",
      title: "Tiếp nhận tại quầy",
      description: "Kiểm hàng, báo giá, tạo đơn hộ khách",
      onPress: onOpenCounter,
    },
    {
      key: "approve",
      title: "Duyệt đơn mới",
      description: "Xác nhận đơn, khóa phí vận chuyển",
      meta: waiting !== undefined ? `${waiting} đơn chờ` : undefined,
      onPress: onOpenApprove,
    },
    ...UPCOMING_TILES,
  ];

  return (
    <RoleHome
      user={user}
      theme={theme}
      onLogout={onLogout}
      profileLines={[["Hub phụ trách", hub ? `${hub.name} (${hub.code})` : "Chưa được gán hub"]]}
      notice="Thấy đơn của hub mình và các bưu cục trực thuộc. Phân công, ca làm việc đang được phát triển (Sprint 4)."
      sections={[{ title: "Công việc tại hub", tiles: workTiles }]}
    />
  );
}
