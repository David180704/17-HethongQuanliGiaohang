import { ErrorCodes } from "../core/errors.js";

/**
 * Tao ham requirePermission(permission) dung PermissionService duoc tiem vao.
 * Dung sau requireAuth (can req.user.role). permission la mang -> co MOT quyen la du
 * (vd xem don: order:read:own | order:read:hub | order:read:assigned).
 * @param {import("../modules/rbac/PermissionService.js").PermissionService} permissionService
 */
export function createRequirePermission(permissionService) {
  return function requirePermission(permission) {
    const anyOf = Array.isArray(permission) ? permission : [permission];
    return async (req, res, next) => {
      if (!req.user) return next(ErrorCodes.UNAUTHORIZED());
      try {
        for (const candidate of anyOf) {
          if (await permissionService.can(req.user.role, candidate)) return next();
        }
        return next(ErrorCodes.FORBIDDEN());
      } catch (err) {
        return next(err);
      }
    };
  };
}
