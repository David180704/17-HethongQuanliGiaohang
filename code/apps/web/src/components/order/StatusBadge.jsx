import { GROUP_BADGE_CLASS } from "../../lib/orderView.js";

// Nhom trang thai cua khach (4 nhom theo de 14) kem ten trang thai chi tiet ben duoi.
export default function StatusBadge({ display, detail = true }) {
  if (!display) return null;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${GROUP_BADGE_CLASS[display.group] || ""}`}
      >
        {display.groupLabel}
      </span>
      {detail && <span className="text-xs text-gray-500">{display.statusLabel}</span>}
    </span>
  );
}
