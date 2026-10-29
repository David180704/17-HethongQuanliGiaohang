import { createHash } from "node:crypto";

/**
 * Cache-aside co "phien ban theo vung" (namespace versioning):
 *   khoa du lieu = cache:<scope>:v<phien ban>:<bam tham so>
 *   xoa ca vung  = tang phien ban (1 lenh INCR, O(1)). Khoa cu khong con duoc doc
 *                  va tu het han theo TTL - khong phai quet KEYS/SCAN tren Redis.
 *
 * Mac dinh TTL 30 giay: du lieu tu MongoDB (vd tren cloud Atlas) duoc "cache xuong"
 * Redis va lam moi toi da moi 30 giay, khong truy van cloud o moi request.
 *
 * Cache chi la toi uu, khong phai phu thuoc: kho cache loi thi doc thang nguon.
 *
 * Kho cache (store) la Strategy - Redis khi chay that, bo nho khi test - mien la
 * co get / set(key, value, ttlSeconds) / incr / del.
 */
export class CacheService {
  #lastWarnAt = 0;

  constructor({ store, defaultTtlSeconds = 30, prefix = "cache" }) {
    this.store = store;
    this.defaultTtlSeconds = defaultTtlSeconds;
    this.prefix = prefix;
  }

  /** @returns {Promise<{ value: any, hit: boolean }>} hit = lay tu cache (khong cham DB) */
  async getOrSet(scope, keyParts, loader, { ttlSeconds = this.defaultTtlSeconds } = {}) {
    if (!(ttlSeconds > 0)) return { value: await loader(), hit: false };

    let key;
    try {
      key = await this.#dataKey(scope, keyParts);
      const cached = await this.store.get(key);
      if (cached !== null && cached !== undefined) return { value: JSON.parse(cached), hit: true };
    } catch (err) {
      this.#warn(err);
      key = null;
    }

    const value = await loader();
    if (key) {
      try {
        await this.store.set(key, JSON.stringify(value ?? null), ttlSeconds);
      } catch (err) {
        this.#warn(err);
      }
    }
    return { value, hit: false };
  }

  /** Doc gia tri dang cache (khong goi loader) - dung cho chan doan va test. */
  async peek(scope, keyParts) {
    const raw = await this.store.get(await this.#dataKey(scope, keyParts));
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  }

  /** Xoa (vo hieu) toan bo du lieu cache cua mot hay nhieu vung. */
  async invalidate(...scopes) {
    for (const scope of scopes) {
      try {
        await this.store.incr(this.#versionKey(scope));
      } catch (err) {
        this.#warn(err);
      }
    }
  }

  #versionKey(scope) {
    return `${this.prefix}:ver:${scope}`;
  }

  async #dataKey(scope, keyParts) {
    const version = (await this.store.get(this.#versionKey(scope))) || "0";
    const hash = createHash("sha1").update(stableStringify(keyParts)).digest("hex").slice(0, 16);
    return `${this.prefix}:${scope}:v${version}:${hash}`;
  }

  // Redis chet thi moi request deu loi cache -> chi canh bao toi da 1 lan/phut.
  #warn(err) {
    if (Date.now() - this.#lastWarnAt > 60_000) {
      this.#lastWarnAt = Date.now();
      console.warn(`[Cache] bo qua cache, doc thang nguon: ${err.message}`);
    }
  }
}

// JSON co thu tu khoa co dinh: { a:1, b:2 } va { b:2, a:1 } ra cung mot khoa cache.
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
