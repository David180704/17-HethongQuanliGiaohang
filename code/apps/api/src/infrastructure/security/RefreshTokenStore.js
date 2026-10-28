// Luu trang thai thu hoi Refresh Token tren Redis.
//   Logout 1 phien : blacklist dung jti cua token, TTL = han con lai cua token.
//   Logout tat ca  : tang "version" cua user; moi token mang version cu vo hieu ngay
//                    ma khong can liet ke tung token.
export class RefreshTokenStore {
  /** @param {import("ioredis").Redis} redis */
  constructor(redis) {
    this.redis = redis;
  }

  async getUserVersion(userId) {
    const value = await this.redis.get(`refresh:ver:${userId}`);
    return value ? Number(value) : 0;
  }

  async bumpUserVersion(userId) {
    await this.redis.incr(`refresh:ver:${userId}`);
  }

  async blacklist(jti, ttlSeconds) {
    if (ttlSeconds > 0) await this.redis.set(`refresh:blacklist:${jti}`, "1", "EX", ttlSeconds);
  }

  async isBlacklisted(jti) {
    return Boolean(await this.redis.get(`refresh:blacklist:${jti}`));
  }
}
