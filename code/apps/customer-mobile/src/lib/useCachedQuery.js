import { useCallback, useEffect, useRef, useState } from "react";
import { queryCache, CACHE_TTL_MS } from "./queryCache";

/**
 * Doc du lieu API qua QueryCache va tu lam moi moi 30 giay khi man hinh dang mo
 * (cung hanh vi voi Web Khach hang).
 * @returns {{ data, meta, loading, error, updatedAt: number|null, refresh: () => void }}
 */
export function useCachedQuery(url, params = {}, { refreshMs = CACHE_TTL_MS, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null, updatedAt: null });
  const paramsKey = JSON.stringify(params);
  const requestSeq = useRef(0);

  const load = useCallback(
    async ({ force = false } = {}) => {
      // Danh so request: ket qua cu ve tre (doi tu khoa lien tuc) thi bo qua.
      const seq = ++requestSeq.current;
      try {
        const { body, fetchedAt } = await queryCache.get(url, JSON.parse(paramsKey), { force });
        if (seq !== requestSeq.current) return;
        setState({ data: body.data, meta: body.meta ?? null, loading: false, error: null, updatedAt: fetchedAt });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setState((prev) => ({ ...prev, loading: false, error: err }));
      }
    },
    [url, paramsKey],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const timer = setInterval(() => load({ force: true }), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs, enabled]);

  const refresh = useCallback(() => load({ force: true }), [load]);
  return { ...state, refresh };
}
