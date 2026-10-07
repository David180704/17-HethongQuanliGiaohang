// Dung chuoi trang thai hop le de dung statusHistory mau cho moi don, theo dung
// vong doi 18 trang thai mo ta trong CLAUDE.md (tai lieu ghi "17" nhung liet ke
// ra 18 gia tri - da bao nguoi dung xac nhan lai, seed script dung du 18 de con
// du lieu demo cho moi nhanh).
const MAIN_CHAIN = [
  "CREATED",
  "CONFIRMED",
  "PICKUP_ASSIGNED",
  "PICKED_UP",
  "SORTED",
  "IN_TRANSIT",
  "AT_HUB",
  "AT_DEST_HUB",
  "DELIVERY_ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function mainUpTo(status) {
  const idx = MAIN_CHAIN.indexOf(status);
  return MAIN_CHAIN.slice(0, idx + 1);
}

export function buildStatusChain(status) {
  if (MAIN_CHAIN.includes(status)) return mainUpTo(status);

  switch (status) {
    case "PICKUP_FAILED":
      return [...mainUpTo("PICKUP_ASSIGNED"), "PICKUP_FAILED"];
    case "DELIVERY_FAILED":
      return [...mainUpTo("OUT_FOR_DELIVERY"), "DELIVERY_FAILED"];
    case "RESCHEDULED":
      return [...mainUpTo("OUT_FOR_DELIVERY"), "DELIVERY_FAILED", "RESCHEDULED"];
    case "RETURNING":
      return [...mainUpTo("OUT_FOR_DELIVERY"), "DELIVERY_FAILED", "RESCHEDULED", "DELIVERY_FAILED", "RETURNING"];
    case "RETURNED":
      return [...buildStatusChain("RETURNING"), "RETURNED"];
    case "CANCELLED":
      return ["CREATED", "CONFIRMED", "CANCELLED"];
    case "INCIDENT":
      return [...mainUpTo("IN_TRANSIT"), "INCIDENT"];
    default:
      throw new Error(`Trang thai khong xac dinh: ${status}`);
  }
}

export function countDeliveryAttempts(chain) {
  return chain.filter((s) => s === "DELIVERY_FAILED").length;
}

export function isAssignedStage(chain) {
  return chain.includes("PICKUP_ASSIGNED");
}
