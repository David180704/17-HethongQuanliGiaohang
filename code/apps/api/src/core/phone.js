// So dien thoai Viet Nam: 10 so (di dong) hoac 11 so (co dinh), bat dau bang 0.
// Cho go cach / cham / gach ("0909 123 456") - luu dang chi con chu so.
export function normalizeVnPhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s.-]/g, "");
  return /^0\d{9,10}$/.test(digits) ? digits : null;
}
