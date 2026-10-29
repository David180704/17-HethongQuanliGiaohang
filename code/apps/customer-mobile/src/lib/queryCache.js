import { apiClient } from "./apiClient";

// Bo nho dem du lieu API phia app - Proxy truoc apiClient (cung thiet ke voi
// apps/web/src/lib/queryCache.js va apps/staff/src/lib/queryCache.js):
//   - GET cung URL + tham so trong 30 giay -> tra ban da luu, KHONG goi API lai
//   - nhieu man hinh cung hoi 1 URL cung luc -> chi 1 request
//   - dang nhap/dang xuat -> clear(): nguoi sau khong thay du lieu cua nguoi truoc
export const CACHE_TTL_MS = 30_000;

function stableParams(params = {}) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

export class QueryCache {
  #entries = new Map(); // key -> { body, fetchedAt }
  #inflight = new Map(); // key -> Promise

  constructor({ client, ttlMs = CACHE_TTL_MS }) {
    this.client = client;
    this.ttlMs = ttlMs;
  }

  keyOf(url, params) {
    return `${url}?${stableParams(params)}`;
  }

  /** @returns {Promise<{ body: object, fetchedAt: number, fromCache: boolean }>} */
  async get(url, params = {}, { force = false } = {}) {
    const key = this.keyOf(url, params);
    const entry = this.#entries.get(key);
    if (!force && entry && Date.now() - entry.fetchedAt < this.ttlMs) return { ...entry, fromCache: true };
    if (this.#inflight.has(key)) return this.#inflight.get(key);

    const request = this.client
      .get(url, { params })
      .then((res) => {
        const fresh = { body: res.data, fetchedAt: Date.now() };
        // Chi luu neu request nay chua bi invalidate()/clear() bo di trong luc cho:
        // ket qua cua nguoi dung truoc khong duoc vao cache.
        if (this.#inflight.get(key) === request) this.#entries.set(key, fresh);
        return { ...fresh, fromCache: false };
      })
      .finally(() => {
        if (this.#inflight.get(key) === request) this.#inflight.delete(key);
      });
    this.#inflight.set(key, request);
    return request;
  }

  /** Xoa moi ban luu cua mot endpoint (moi tham so), ke ca request dang chay. */
  invalidate(url) {
    for (const map of [this.#entries, this.#inflight]) {
      for (const key of [...map.keys()]) {
        if (key.startsWith(`${url}?`)) map.delete(key);
      }
    }
  }

  clear() {
    this.#entries.clear();
    this.#inflight.clear();
  }
}

export const queryCache = new QueryCache({ client: apiClient });
