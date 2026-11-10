// Khoang cach va geofence (US-30) - ham thuan.
const EARTH_RADIUS_M = 6371000;
const rad = (deg) => (deg * Math.PI) / 180;

/** Khoang cach mat cau (haversine), don vi met. */
export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Cac diem ma vi tri nam trong ban kinh (mac dinh 150 m), gan nhat truoc. */
export function pointsInRange(position, points) {
  return points
    .map((point) => ({ point, distanceM: Math.round(distanceM(position, point)) }))
    .filter(({ point, distanceM: d }) => d <= (point.radiusM ?? 150))
    .sort((x, y) => x.distanceM - y.distanceM);
}

export const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
// Check-in tay (du phong khi GPS lech): chi nhan neu cach diem khong qua 1 km
export const MANUAL_MAX_DISTANCE_M = 1000;
