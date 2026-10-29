import { ErrorCodes } from "../core/errors.js";

/**
 * Tao ham requirePermission(permission) dung PermissionService duoc tiem vao.
 * Dung sau requireAuth (can req.user.role).
 * @param {import("../modules/rbac/PermissionService.js").PermissionService} permissionService
 */
export function createRequirePermission(permissionService) {
  return function requirePermission(permission) {
    return async (req, res, next) => {
      if (!req.user) return next(ErrorCodes.UNAUTHORIZED());
      try {
        if (await permissionService.can(req.user.role, permission)) return next();
        return next(ErrorCodes.FORBIDDEN());
      } catch (err) {
        return next(err);
      }
    };
  };
}
