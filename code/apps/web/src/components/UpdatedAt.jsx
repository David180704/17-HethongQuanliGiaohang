import { formatUpdatedAt } from "../lib/useCachedQuery.js";

// Cho nguoi dung (va nguoi cham demo) thay du lieu dang lay tu cache, lam moi 30 giay/lan.
export default function UpdatedAt({ date, onRefresh }) {
  if (!date) return null;
  return (
    <p className="text-xs text-gray-400" data-testid="updated-at">
      Cập nhật lúc {formatUpdatedAt(date)} · tự làm mới mỗi 30 giây
      {onRefresh && (
        <>
          {" · "}
          <button type="button" onClick={onRefresh} className="font-medium text-brand-600 hover:underline">
            Làm mới ngay
          </button>
        </>
      )}
    </p>
  );
}
