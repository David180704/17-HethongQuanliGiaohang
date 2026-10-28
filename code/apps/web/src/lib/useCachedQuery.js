import { useCallback, useEffect, useRef, useState } from "react";
import { queryCache, CACHE_TTL_MS } from "./queryCache.js";

/**
 * Doc du lieu API qua QueryCache va tu lam moi moi 30 giay khi man hinh dang mo.
 * @returns {{ data, meta, loading, error, updatedAt: Date|null, refresh: () => void }}
 */
export function useCachedQuery(url, params = {}, { refreshMs = CACHE_TTL_MS } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: true, error: null, updatedAt: null });
  const paramsKey = JSON.stringify(params);
  const requestSeq = useRef(0);

  const load = useCallback(
    async ({ force = false } = {}) => {
      // Danh so request: ket qua cu ve tre (doi tham so lien tuc) thi bo qua.
      const seq = ++requestSeq.current;
      try {
        const { body, fetchedAt } = await queryCache.get(url, JSON.parse(paramsKey), { force });
        if (seq !== requestSeq.current) return;
        setState({ data: body.data, meta: body.meta ?? null, loading: false, error: null, updatedAt: new Date(fetchedAt) });
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setState((prev) => ({ ...prev, loading: false, error: err }));
      }
    },
    [url, paramsKey],
  );

  useEffect(() => {
    // Dong bo voi he thong ngoai (API) - dung truong hop quy tac nay cho phep;
    // setState chi chay sau khi request tra ve.
    // oxlint-disable-next-line react/set-state-in-effect
    load();
    const timer = setInterval(() => load({ force: true }), refreshMs);
    return () => clearInterval(timer);
  }, [load, refreshMs]);

  const refresh = useCallback(() => load({ force: true }), [load]);
  return { ...state, refresh };
}

export function formatUpdatedAt(date) {
  return date ? date.toLocaleTimeString("vi-VN", { hour12: false }) : "";
}
