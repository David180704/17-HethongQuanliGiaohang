// Goi y phuong tien giao (US-40, de 14 muc b.A): nhan vien kiem hang nang/nhe, lon/nho, hang la xe de chon
// phuong tien. Ham thuan; nguong chot o ngay phan tich Sprint 4.
export const TRUCK_MIN_CHARGEABLE_GRAM = 30_000; // tren 30 kg tinh phi
export const TRUCK_MIN_SIDE_CM = 100; // canh dai nhat tren 100 cm

export const VEHICLES = { MOTORBIKE: "Xe máy", TRUCK: "Xe tải" };

/** @returns {{ code: "MOTORBIKE"|"TRUCK", label: string, reason: string }} */
export function suggestVehicle({ chargeableWeight, item = {}, flags = {} }) {
  const truck = (reason) => ({ code: "TRUCK", label: VEHICLES.TRUCK, reason });
  if (flags.isVehicle) return truck("Hàng là xe");
  if (chargeableWeight > TRUCK_MIN_CHARGEABLE_GRAM) return truck("Khối lượng tính phí trên 30 kg");
  const longest = Math.max(item.length || 0, item.width || 0, item.height || 0);
  if (longest > TRUCK_MIN_SIDE_CM) return truck("Cạnh dài nhất trên 100 cm");
  return { code: "MOTORBIKE", label: VEHICLES.MOTORBIKE, reason: "Hàng nhỏ, nhẹ" };
}
