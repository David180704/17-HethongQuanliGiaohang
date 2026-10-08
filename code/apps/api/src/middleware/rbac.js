import { Role } from "../models/Role.js";
import { getRedis } from "../config/redis.js";
import { ErrorCodes } from "../core/errors.js";

const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = "perm:";

// Duyet cay ke thua inheritsFrom de gop toan bo permission cua role va cac
// role cha. CUSTOMER inheritsFrom GUEST nen phai duyet cay, khong so khop phang.
async function resolvePermissionsFromDB(roleCode) {
  const permissions = new Set();
  let currentCode = roleCode;
  const visited = new Set();

  while (currentCode && !visited.has(currentCode)) {
    visited.add(currentCode);
    const role = await Role.findOne({ code: currentCode }).lean();
    if (!role) break;
    for (const p of role.permissions) permissions.add(p);
    currentCode = role.inheritsFrom;
  }

  return [...permissions];
}

export async function resolvePermissions(roleCode) {
  const redis = getRedis();
  const cacheKey = `${CACHE_KEY_PREFIX}${roleCode}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis loi thi bo qua cache, tra truc tiep tu DB.
  }

  const permissions = await resolvePermissionsFromDB(roleCode);

  try {
    await redis.set(cacheKey, JSON.stringify(permissions), "EX", CACHE_TTL_SECONDS);
  } catch {
    // Khong cache duoc cung khong sao, lan sau lai truy DB.
  }

  return permissions;
}

export async function invalidatePermissionsCache(roleCode) {
  try {
    await getRedis().del(`${CACHE_KEY_PREFIX}${roleCode}`);
  } catch {
    // Khong co cache de xoa cung khong sao.
  }
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) return next(ErrorCodes.UNAUTHORIZED());

    const permissions = await resolvePermissions(req.user.role);
    if (!permissions.includes(permission)) {
      return next(ErrorCodes.FORBIDDEN());
    }
    return next();
  };
}
