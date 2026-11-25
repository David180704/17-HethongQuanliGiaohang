// Doc ma van don tu noi dung QR / ma vach quet duoc. Phieu giao in QR chua dung ma van don (EXP + 10 so);
// chap nhan ca lien ket tra cuu co ma ben trong (vd https://.../tra-cuu?ma=EXP1000000123).
const TRACKING_RE = /EXP\d{10}/i;

export function extractTrackingCode(data) {
  if (typeof data !== "string") return null;
  const match = data.trim().match(TRACKING_RE);
  return match ? match[0].toUpperCase() : null;
}
