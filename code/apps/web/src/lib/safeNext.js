// Tham so ?next= sau dang nhap chi duoc tro ve trang TRONG site. Chan
// "https://evil.com" va "//evil.com" (URL khong giao thuc) - tranh open redirect.
export function safeNext(next, fallback = "/") {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
