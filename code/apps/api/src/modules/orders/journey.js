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

export function buildPublicJourney(order) {
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
      district: order.receiver?.district,
      province: order.receiver?.province,
    },
    events: (order.statusHistory || []).map((h) => ({
      at: new Date(h.at).toISOString(),
      status: h.status,
      label: STATUS_LABELS[h.status] || h.status,
    })),
    updatedAt: new Date(order.updatedAt || Date.now()).toISOString(),
  };
}
