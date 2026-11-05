// Mot nguon duy nhat cho cach hien thi trang thai don (US-20, US-22): nhan tieng Viet cua 18 trang
// thai va cach gom thanh 4 nhom ma khach thay theo de 14 - Chua nhan, Da nhan - Chua giao, Da nhan -
// Dang giao, Da giao. Web, App Khach hang va tra cuu cong khai deu dung nhan do API tra ve.

export const STATUS_LABELS = {
  CREATED: "Chờ bưu cục xác nhận",
  CONFIRMED: "Đã xác nhận, chờ lấy hàng",
  PICKUP_ASSIGNED: "Đã phân công lấy hàng",
  PICKED_UP: "Đã lấy hàng",
  SORTED: "Đã phân loại tại kho",
  IN_TRANSIT: "Đang trung chuyển",
  AT_HUB: "Đã nhập kho",
  AT_DEST_HUB: "Đã đến kho giao",
  DELIVERY_ASSIGNED: "Đã phân công giao hàng",
  OUT_FOR_DELIVERY: "Đang giao hàng",
  DELIVERED: "Giao thành công",
  PICKUP_FAILED: "Lấy hàng không thành công",
  DELIVERY_FAILED: "Giao không thành công",
  RESCHEDULED: "Chờ giao lại",
  RETURNING: "Đang hoàn về người gửi",
  RETURNED: "Đã hoàn trả người gửi",
  CANCELLED: "Đã hủy",
  INCIDENT: "Đang xử lý sự cố",
};

// Gom theo ai dang giu hang: chua nhan tu nguoi gui / cong ty dang giu / dang mang di giao / da trao tay.
// Hoan hang la mot luot giao tra ve nguoi gui nen RETURNING = dang giao, RETURNED = da giao.
export const CUSTOMER_GROUPS = [
  {
    code: "NOT_RECEIVED",
    label: "Chưa nhận",
    statuses: ["CREATED", "CONFIRMED", "PICKUP_ASSIGNED", "PICKUP_FAILED", "CANCELLED"],
  },
  {
    code: "RECEIVED",
    label: "Đã nhận – Chưa giao",
    statuses: ["PICKED_UP", "AT_HUB", "SORTED", "IN_TRANSIT", "AT_DEST_HUB", "DELIVERY_ASSIGNED", "DELIVERY_FAILED",
      "RESCHEDULED"],
  },
  { code: "DELIVERING", label: "Đã nhận – Đang giao", statuses: ["OUT_FOR_DELIVERY", "RETURNING"] },
  { code: "DELIVERED", label: "Đã giao", statuses: ["DELIVERED", "RETURNED"] },
];

const GROUP_OF_STATUS = Object.fromEntries(CUSTOMER_GROUPS.flatMap((g) => g.statuses.map((s) => [s, g])));
const FALLBACK_GROUP = CUSTOMER_GROUPS[1];

/** Trang thai dung de xep nhom: INCIDENT lay trang thai lien truoc (khong phai INCIDENT) trong hanh trinh. */
export function effectiveStatus(order) {
  if (order.status !== "INCIDENT") return order.status;
  const history = order.statusHistory || [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].status !== "INCIDENT") return history[i].status;
  }
  return null;
}

export function customerGroup(order) {
  return GROUP_OF_STATUS[effectiveStatus(order)] || FALLBACK_GROUP;
}

/** Dieu kien MongoDB loc theo nhom - khop dung customerGroup() ke ca don INCIDENT. null neu ma nhom sai. */
export function groupFilter(code) {
  const group = CUSTOMER_GROUPS.find((g) => g.code === code);
  if (!group) return null;
  const lastNonIncident = {
    $arrayElemAt: [{ $filter: { input: "$statusHistory.status", cond: { $ne: ["$$this", "INCIDENT"] } } }, -1],
  };
  return {
    $or: [
      { status: { $in: group.statuses } },
      { status: "INCIDENT", $expr: { $in: [lastNonIncident, group.statuses] } },
    ],
  };
}

/** Gan thong tin hien thi vao don (khong doi du lieu goc). */
export function withDisplay(order) {
  if (!order) return order;
  const group = customerGroup(order);
  return {
    ...order,
    display: { statusLabel: STATUS_LABELS[order.status] || order.status, group: group.code, groupLabel: group.label },
    statusHistory: (order.statusHistory || []).map((h) => ({ ...h, label: STATUS_LABELS[h.status] || h.status })),
  };
}
