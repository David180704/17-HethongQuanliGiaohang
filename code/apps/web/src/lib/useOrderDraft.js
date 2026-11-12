import { useEffect, useState } from "react";
import { apiClient } from "./apiClient.js";

/**
 * Mo lai ban nhap don theo draftToken (US-16). Khach da dang nhap mo nhap chua co
 * chu -> server gan nhap vao tai khoan nay. Khong doc qua cache: nhap doi theo tung buoc.
 * @returns {{ draft: { payload, expiresAt } | null, error, loading: boolean }}
 */
export function useOrderDraft(draftToken) {
  const [state, setState] = useState({ draft: null, error: null, loading: Boolean(draftToken) });

  useEffect(() => {
    if (!draftToken) return undefined;
    let cancelled = false;
    apiClient
      .get(`/orderDrafts/${encodeURIComponent(draftToken)}`)
      .then((res) => !cancelled && setState({ draft: res.data.data, error: null, loading: false }))
      .catch((err) => !cancelled && setState({ draft: null, error: err, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [draftToken]);

  return state;
}
