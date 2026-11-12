// Khoang cach giua noi gui va noi nhan (km, duong chim bay) tu toa do tam xa/phuong.
// Toa do lay mot lan tu OpenStreetMap (Nominatim) luu o src/data/toaDoXaPhuong.json; xa/phuong
// nao chua co toa do thi dung tam tinh/thanh (approx = true). Ham thuan, khong DB.
import { existsSync, readFileSync } from "node:fs";
import { URL } from "node:url";

const FILE = new URL("../../data/toaDoXaPhuong.json", import.meta.url);
const coords = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { provinces: {}, wards: {} };

/** Toa do [lat, lng] cua xa/phuong; thieu thi lay tam tinh. */
export function pointOf({ province, ward }) {
  const exact = coords.wards[`${province}|${ward}`];
  if (exact) return { point: exact, approx: false };
  const center = coords.provinces[province];
  return center ? { point: center, approx: true } : null;
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const rad = (x) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Khoang cach giua hai khu vuc (province + ward), lam tron 0,1 km.
 * @returns {{ km: number, approx: boolean } | null} null khi chua co toa do ca hai dau
 */
export function distanceBetween(from, to) {
  if (from.province === to.province && from.ward === to.ward) return { km: 0, approx: false };
  const a = pointOf(from);
  const b = pointOf(to);
  if (!a || !b) return null;
  return { km: Math.round(haversineKm(a.point, b.point) * 10) / 10, approx: a.approx || b.approx };
}
