import { ErrorCodes } from "../core/errors.js";
import { verifyAccessToken } from "../core/jwt.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(ErrorCodes.UNAUTHORIZED());
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, hubId: payload.hubId ?? null };
    return next();
  } catch {
    return next(ErrorCodes.UNAUTHORIZED("Token khong hop le hoac da het han"));
  }
}

// Dung cho 3 endpoint cong khai (dang ky, dang nhap, dat lai mat khau): nguoi
// da xac thuc thi khong duoc truy cap, phai chuyen huong ve trang chinh.
export function guardAuthenticated(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      verifyAccessToken(token);
      return next(ErrorCodes.ALREADY_AUTHENTICATED());
    } catch {
      // Token khong hop le thi coi nhu chua dang nhap, cho qua binh thuong.
    }
  }
  return next();
}
