/**
 * Phan quyen (US-09): gop quyen cua vai tro va moi vai tro cha theo cay
 * inheritsFrom (CUSTOMER -> GUEST), khong so khop phang. Ket qua cache 5 phut.
 *
 * Doi quyen cua MOT vai tro phai xoa cache cua CA vung "permissions": vai tro con
 * ke thua (doi quyen GUEST thi quyen CUSTOMER cung doi). Ban cu chi xoa dung vai
 * tro bi sua -> CUSTOMER giu quyen cu toi 5 phut.
 */
export class PermissionService {
  /**
   * @param {object} deps
   * @param {{ findOne(filter): Promise<object|null> }} deps.roleRepository
   * @param {import("../../infrastructure/cache/CacheService.js").CacheService} deps.cache
   */
  constructor({ roleRepository, cache, ttlSeconds = 300 }) {
    this.roleRepository = roleRepository;
    this.cache = cache;
    this.ttlSeconds = ttlSeconds;
  }

  async resolve(roleCode) {
    const { value } = await this.cache.getOrSet("permissions", [roleCode], () => this.#resolveFromDb(roleCode), {
      ttlSeconds: this.ttlSeconds,
    });
    return value;
  }

  /** "*" la quyen wildcard cua ADMIN. */
  async can(roleCode, permission) {
    const permissions = await this.resolve(roleCode);
    return permissions.includes("*") || permissions.includes(permission);
  }

  invalidate() {
    return this.cache.invalidate("permissions");
  }

  async #resolveFromDb(roleCode) {
    const permissions = new Set();
    const visited = new Set();
    let currentCode = roleCode;
    while (currentCode && !visited.has(currentCode)) {
      visited.add(currentCode);
      const role = await this.roleRepository.findOne({ code: currentCode });
      if (!role) break;
      for (const permission of role.permissions) permissions.add(permission);
      currentCode = role.inheritsFrom;
    }
    return [...permissions];
  }
}
