// Hanh trinh cong khai cua mot don (US-21 ghi, US-22 doc): ham thuan, dung lai nhan va nhom trang thai
// cua orderStatus.js. Chi dua thong tin an toan cho nguoi chi biet ma van don: khong ten, so dien thoai
// day du hay dia chi cu the.
import { STATUS_LABELS, customerGroup } from "./orderStatus.js";

/** "0912345678" -> "09xx xxx 678" (giu 2 so dau va 3 so cuoi). */
export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${digits.slice(0, 2)}xx xxx ${digits.slice(-3)}`;
}

export function buildPublicJourney(order, checkins = []) {
  const group = customerGroup(order);
  return {
    trackingCode: order.trackingCode,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] || order.status,
    group: group.code,
    groupLabel: group.label,
    serviceName: order.serviceName,
    sender: { name: order.customerName, ward: order.pickupWard },
    receiver: {
      phone: maskPhone(order.receiver?.phone),
      ward: order.receiver?.ward,
      province: order.receiver?.province,
    },
    events: (order.statusHistory || []).map((h) => ({
      at: new Date(h.at).toISOString(),
      status: h.status,
      label: STATUS_LABELS[h.status] || h.status,
    })),
    // Cac diem don da di qua (US-30): ten diem va thoi gian, moi nhat truoc - khong lo toa do, nguoi giao
    checkins: [...checkins]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((c) => ({ at: new Date(c.at).toISOString(), point: c.point?.name || "Điểm check-in" })),
    updatedAt: new Date(order.updatedAt || Date.now()).toISOString(),
  };
}
