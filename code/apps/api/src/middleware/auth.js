import { ErrorCodes } from "../core/errors.js";

function readBearerToken(req) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  return scheme === "Bearer" && token ? token : null;
}

/**
 * Tao middleware xac thuc tu mot TokenService duoc tiem vao (Dependency Inversion:
 * middleware khong tu import JWT/secret).
 * @param {{ verifyAccess(token: string): { sub: string, role: string, hubId?: string } }} tokenService
 */
export function createAuthMiddleware(tokenService) {
  function requireAuth(req, res, next) {
    const token = readBearerToken(req);
    if (!token) return next(ErrorCodes.UNAUTHORIZED());
    try {
      const payload = tokenService.verifyAccess(token);
      req.user = { id: payload.sub, role: payload.role, hubId: payload.hubId ?? null };
      return next();
    } catch {
      return next(ErrorCodes.UNAUTHORIZED("Token không hợp lệ hoặc đã hết hạn"));
    }
  }

  // Guard nguoc cho dang ky / dang nhap / dat lai mat khau: nguoi da xac thuc thi
  // khong duoc goi lai. Token khong hop le thi coi nhu chua dang nhap, cho qua.
  function guardAuthenticated(req, res, next) {
    const token = readBearerToken(req);
    if (token) {
      try {
        tokenService.verifyAccess(token);
        return next(ErrorCodes.ALREADY_AUTHENTICATED());
      } catch {
        // khong hop le -> nhu khach
      }
    }
    return next();
  }

  return { requireAuth, guardAuthenticated };
}
