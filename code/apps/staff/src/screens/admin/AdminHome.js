import { useEffect, useState } from "react";
import RoleHome from "../RoleHome";
import { CATALOGS } from "./catalogs";
import { apiClient } from "../../lib/apiClient";

const CATALOG_TILES = [
  { key: "users", description: "Tài khoản, vai trò, khóa/mở" },
  { key: "routes", description: "Tuyến giao nhận, năng lực mỗi ca" },
  { key: "serviceAreas", description: "Quận/huyện thuộc từng tuyến" },
  { key: "serviceTypes", description: "Gửi thường, gửi nhanh, phụ phí" },
];

// Ma hang muc va Sprint lay tu sheet "Sprint backlog" (docs/ProductBacklog-nhom17.xlsx)
const UPCOMING_TILES = [
  { key: "priceTables", title: "Bảng giá", description: "Giá theo vùng và bậc khối lượng", upcoming: "#13 · Sprint 3" },
  { key: "hubs", title: "Hub & bưu cục", description: "Điểm tập kết, bưu cục", upcoming: "#14 · Sprint 3" },
  { key: "settlements", title: "Đối soát", description: "Tổng hợp COD trả cho shop", upcoming: "#34 · Sprint 5" },
  { key: "dashboard", title: "Thống kê", description: "Dashboard tổng hợp", upcoming: "#39 · Sprint 6" },
];

export default function AdminHome({ user, theme, onLogout, onOpenCatalog }) {
  const [counts, setCounts] = useState({});

  // So ban ghi that cua tung danh muc (limit=1, chi lay meta.total). Chay lai moi
  // lan quay ve trang chu, nen them/xoa xong la so cap nhat ngay.
  useEffect(() => {
    let cancelled = false;
    for (const tile of CATALOG_TILES) {
      apiClient
        .get(CATALOGS[tile.key].endpoint, { params: { limit: 1 } })
        .then((res) => {
          if (!cancelled) setCounts((prev) => ({ ...prev, [tile.key]: res.data.meta.total }));
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
        { title: "Sắp có", tiles: UPCOMING_TILES },
      ]}
    />
  );
}
