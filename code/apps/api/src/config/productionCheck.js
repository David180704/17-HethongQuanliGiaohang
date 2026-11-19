// Kiem tra cau hinh khi chay that (US-45). Ham thuan: nhan bien moi truong, tra danh sach loi tieng Viet.
// server.js goi truoc khi mo cong; thieu cau hinh thi dung ngay thay vi chay voi secret mac dinh / CSDL tren may dev.
const DEV_SECRETS = ["dev-access-secret", "dev-refresh-secret"];
const MIN_SECRET_LENGTH = 32;

export function productionProblems(vars) {
  if (vars.NODE_ENV !== "production") return [];
  const problems = [];
  if (!vars.MONGO_URI || /localhost|127\.0\.0\.1/.test(vars.MONGO_URI)) {
    problems.push("MONGO_URI phải trỏ tới CSDL trên máy chủ (MongoDB Atlas), không phải localhost");
  }
  if (!vars.REDIS_URL || /localhost|127\.0\.0\.1/.test(vars.REDIS_URL)) {
    problems.push("REDIS_URL phải trỏ tới Redis trên máy chủ");
  }
  for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    const value = vars[name];
    if (!value || DEV_SECRETS.includes(value) || value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} phải đặt giá trị ngẫu nhiên dài tối thiểu ${MIN_SECRET_LENGTH} ký tự`);
    }
  }
  if (vars.JWT_ACCESS_SECRET && vars.JWT_ACCESS_SECRET === vars.JWT_REFRESH_SECRET) {
    problems.push("JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau");
  }
  const origins = (vars.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => !origin.startsWith("https://"))) {
    problems.push("CORS_ORIGIN phải liệt kê địa chỉ https:// của Web Khách hàng và Web Nhân viên");
  }
  if (!vars.PUBLIC_API_URL || !vars.PUBLIC_API_URL.startsWith("https://")) {
    problems.push("PUBLIC_API_URL phải là địa chỉ https:// công khai của API (VNPay gọi IPN về đây)");
  }
  return problems;
}
