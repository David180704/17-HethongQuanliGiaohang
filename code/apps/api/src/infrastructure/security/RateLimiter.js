// Bo dem gioi han tan suat tren Redis (cua so co dinh): moi khoa dem so lan goi trong `windowSeconds`,
// khoa tu het han khi het cua so. Dung chung Redis nen nhieu tien trinh API van dem chung (US-22).
export class RateLimiter {
  /** @param {import("ioredis").Redis} redis */
  constructor(redis) {
    this.redis = redis;
  }

  /** @returns {Promise<{ count: number, ttlSeconds: number }>} so lan da goi trong cua so hien tai */
  async hit(key, windowSeconds) {
    const [[, count], [, ttl]] = await this.redis
      .multi()
      .incr(key)
      .expire(key, windowSeconds, "NX")
      .ttl(key)
      .exec();
    return { count, ttlSeconds: ttl > 0 ? ttl : windowSeconds };
  }
}
