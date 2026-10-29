import { formatVnd } from "../lib/format.js";

const LINES = [
  ["base", "Cước cơ bản"],
  ["weightSurcharge", "Phụ phí khối lượng"],
  ["serviceSurcharge", "Phụ phí dịch vụ"],
  ["specialSurcharge", "Phụ phí hàng đặc biệt"],
];

// Tach ro tung khoan cau thanh phi (US-17) - dung o trang uoc tinh va buoc xac nhan tao don.
export default function FeeBreakdown({ fee, label = "Chi tiết phí" }) {
  return (
    <dl className="space-y-1 text-sm" aria-label={label}>
      {LINES.map(([key, text]) => (
        <div key={key} className="flex justify-between gap-4">
          <dt className="text-gray-500">{text}</dt>
          <dd>{formatVnd(fee[key])}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-gray-200 pt-1 font-semibold">
        <dt>Tổng phí vận chuyển</dt>
        <dd>{formatVnd(fee.total)}</dd>
      </div>
    </dl>
  );
}
