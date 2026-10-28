import { apiClient } from "./apiClient";

// Bo nho dem du lieu API phia app - Proxy truoc apiClient (cung thiet ke voi
// apps/web/src/lib/queryCache.js):
//   - GET cung URL + tham so trong 30 giay -> tra ban da luu, KHONG goi API lai
//   - nhieu man hinh cung hoi 1 URL cung luc -> chi 1 request
//   - ghi xong -> invalidate(url) de thay du lieu moi ngay
// Dang xuat phai clear(): may dung chung nhieu ca, nguoi sau khong duoc thay
// du lieu cua nguoi truoc.
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
        this.#entries.set(key, fresh);
        return { ...fresh, fromCache: false };
      })
      .finally(() => this.#inflight.delete(key));
    this.#inflight.set(key, request);
    return request;
  }

  /** Xoa moi ban luu cua mot endpoint (moi trang, moi tu khoa). */
  invalidate(url) {
    for (const key of [...this.#entries.keys()]) {
      if (key.startsWith(`${url}?`)) this.#entries.delete(key);
    }
  }

  clear() {
    this.#entries.clear();
  }
}

export const queryCache = new QueryCache({ client: apiClient });

export function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
