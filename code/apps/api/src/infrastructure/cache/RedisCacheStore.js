// Adapter pattern: boc ioredis ve giao dien kho cache toi gian ma CacheService can
// (get / set / incr / del). Doi sang kho khac (Upstash, Memcached...) chi can viet
// mot adapter moi, CacheService va service nghiep vu khong doi.
export class RedisCacheStore {
  /** @param {import("ioredis").Redis} redis */
  constructor(redis) {
    this.redis = redis;
  }

  get(key) {
    return this.redis.get(key);
  }

  set(key, value, ttlSeconds) {
    return ttlSeconds ? this.redis.set(key, value, "EX", ttlSeconds) : this.redis.set(key, value);
  }

  incr(key) {
    return this.redis.incr(key);
  }

  del(key) {
    return this.redis.del(key);
  }
}
