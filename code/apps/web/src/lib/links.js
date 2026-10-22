// App Nhan vien chay cong 8082, cung may voi web nay (xem apps/staff).
export const STAFF_APP_URL =
  import.meta.env.VITE_STAFF_APP_URL || `${window.location.protocol}//${window.location.hostname}:8082`;
