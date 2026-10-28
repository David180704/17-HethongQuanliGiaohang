// Strategy thay the cho RedisCacheStore: kho cache trong bo nho tien trinh, cung
// giao dien get / set / incr / del. Dung cho unit test (khong can Redis) hoac
// khi muon chay API khong co Redis (CACHE_STORE=memory).
export class MemoryCacheStore {
  #entries = new Map(); // key -> { value, expiresAt }

  async get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.#entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    this.#entries.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  async incr(key) {
    const next = (Number(await this.get(key)) || 0) + 1;
    this.#entries.set(key, { value: String(next), expiresAt: null });
    return next;
  }

  async del(key) {
    this.#entries.delete(key);
  }
}
