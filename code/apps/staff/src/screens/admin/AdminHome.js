import { useEffect, useState } from "react";
import RoleHome from "../RoleHome";
import { CATALOGS } from "./catalogs";
import { queryCache } from "../../lib/queryCache";

const CATALOG_TILES = [
  { key: "users", description: "Tài khoản, vai trò, khóa/mở" },
  { key: "hubs", description: "Điểm tập kết, bưu cục trực thuộc" },
  { key: "routes", description: "Tuyến giao nhận, năng lực mỗi ca" },
  { key: "serviceAreas", description: "Quận/huyện thuộc từng tuyến" },
  { key: "serviceTypes", description: "Gửi thường, gửi nhanh, phụ phí" },
  { key: "priceTables", description: "Giá theo vùng và bậc khối lượng" },
  { key: "checkinPoints", description: "Tọa độ, bán kính tự check-in" },
];

// Ma hang muc va Sprint lay tu sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
const UPCOMING_TILES = [
  { key: "settlements", title: "Đối soát", description: "Tổng hợp COD trả cho shop", upcoming: "#34 · Sprint 7" },
  { key: "dashboard", title: "Thống kê", description: "Dashboard tổng hợp", upcoming: "#39 · Sprint 7" },
];

export default function AdminHome({ user, theme, onLogout, onOpenCatalog, onOpenCapacity }) {
  const [counts, setCounts] = useState({});

  // So ban ghi that cua tung danh muc (limit=1, chi lay meta.total), doc qua cache
  // 30 giay. Them/xoa trong danh muc da xoa cache endpoint do -> quay ve la so moi.
  useEffect(() => {
    let cancelled = false;
    for (const tile of CATALOG_TILES) {
      queryCache
        .get(CATALOGS[tile.key].endpoint, { limit: 1 })
        .then(({ body }) => {
          if (!cancelled) setCounts((prev) => ({ ...prev, [tile.key]: body.meta.total }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogTiles = CATALOG_TILES.map((tile) => ({
    ...tile,
    title: CATALOGS[tile.key].title,
    meta: counts[tile.key] !== undefined ? `${counts[tile.key]} bản ghi` : undefined,
    onPress: () => onOpenCatalog(tile.key),
  }));

  return (
    <RoleHome
      user={user}
      theme={theme}
      onLogout={onLogout}
      sections={[
        { title: "Danh mục", tiles: catalogTiles },
        {
          title: "Vận hành",
          tiles: [{ key: "capacity", title: "Phân công", description: "Năng lực mặc định hệ thống, tuyến, người giao hàng", onPress: onOpenCapacity }],
        },
        { title: "Sắp có", tiles: UPCOMING_TILES },
      ]}
    />
  );
}
