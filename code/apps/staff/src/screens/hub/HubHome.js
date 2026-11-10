import { useEffect, useState } from "react";
import RoleHome from "../RoleHome";
import { queryCache } from "../../lib/queryCache";
import { apiClient } from "../../lib/apiClient";

// Ma hang muc va Sprint lay tu sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
const UPCOMING_TILES = [
  { key: "incidents", title: "Sự cố, khiếu nại", description: "Ghi nhận và theo dõi xử lý", upcoming: "#38 · Sprint 7" },
];

export default function HubHome({ user, theme, onLogout, onOpenApprove, onOpenCounter, onOpenShifts, onOpenCapacity, onOpenAssign }) {
  const hub = user.hubId;
  const [waiting, setWaiting] = useState();
  const [queued, setQueued] = useState();

  // So don cho duyet that (limit=1, chi lay meta.total), qua cache 30 giay
  useEffect(() => {
    let cancelled = false;
    queryCache
      .get("/orders", { status: "CREATED", limit: 1 })
      .then(({ body }) => !cancelled && setWaiting(body.meta.total))
      .catch(() => {});
    // Hang cho phan cong lay hang (US-25) - doc thang, so lieu doi lien tuc
    apiClient
      .get("/assignments/pickup")
      .then((res) => !cancelled && setQueued(res.data.data.queue.length))
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
    {
      key: "assign",
      title: "Phân công lấy hàng",
      description: "Tự động theo ca và năng lực, điều chỉnh tay",
      meta: queued !== undefined ? `${queued} đơn chờ phân công` : undefined,
      onPress: onOpenAssign,
    },
    {
      key: "shifts",
      title: "Ca làm việc",
      description: "Xếp người giao hàng vào ca theo tuyến",
      onPress: onOpenShifts,
    },
    {
      key: "capacity",
      title: "Năng lực mỗi ca",
      description: "Số đơn tối đa theo tuyến, theo người",
      onPress: onOpenCapacity,
    },
    ...UPCOMING_TILES,
  ];

  return (
    <RoleHome
      user={user}
      theme={theme}
      onLogout={onLogout}
      profileLines={[["Hub phụ trách", hub ? `${hub.name} (${hub.code})` : "Chưa được gán hub"]]}
      notice="Thấy đơn của hub mình và các bưu cục trực thuộc. Đơn duyệt xong được phân công tự động cho người trực ca."
      sections={[{ title: "Công việc tại hub", tiles: workTiles }]}
    />
  );
}
