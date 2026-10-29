import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { errorMessage } from "../lib/apiClient.js";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { useOrderDraft } from "../lib/useOrderDraft.js";

// Trang da duoc bao ve (phai dang nhap). Nghiep vu tao don thuoc #18 (Sprint 3),
// backend chua co - hien khung 4 buoc de nguoi dung biet luong se dien ra.
const STEPS = [
  { title: "Người gửi & lấy hàng", text: "Chọn địa điểm lấy hàng đã lưu (tối đa 10)." },
  { title: "Người nhận", text: "Địa chỉ phải thuộc vùng phục vụ." },
  { title: "Hàng hóa", text: "Khối lượng, kích thước, hàng dễ vỡ/giá trị cao." },
  { title: "Dịch vụ & thanh toán", text: "Gửi thường/nhanh, thu hộ COD, ai trả phí ship." },
];

export default function CreateOrderPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const { draft, error: draftError } = useOrderDraft(params.get("draft"));
  const { data: serviceTypes } = useCachedQuery("/public/service-types");
  const estimate = draft?.payload;
  const service = serviceTypes?.find((type) => type._id === estimate?.serviceTypeId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tạo đơn hàng</h1>
      <p className="mt-1 text-gray-600">
        Đang đăng nhập: <span className="font-semibold text-gray-800">{user.fullName}</span>
      </p>

      {draftError && (
        <div role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage(draftError, "Không mở được thông tin đã nhập")}
        </div>
      )}
      {estimate?.pickup && (
        <section aria-label="Thông tin đã nhập khi ước tính phí" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <h2 className="font-semibold">Đã giữ thông tin bạn nhập khi ước tính phí</h2>
          <p className="mt-1">
            Gửi từ {estimate.pickup.district}, {estimate.pickup.province} → {estimate.receiver.district}, {estimate.receiver.province}
          </p>
          <p>
            {estimate.item.weightGram} g · {estimate.item.length}×{estimate.item.width}×{estimate.item.height} cm
            {service ? ` · ${service.name}` : ""}
          </p>
        </section>
      )}

      <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Chức năng tạo đơn đang được phát triển (hạng mục #18 · Sprint 3). Khi hoàn thành, đơn sẽ được tạo ngay tại
        trang này qua 4 bước dưới đây.
      </div>

      <ol className="mt-6 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 opacity-80">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-200 font-bold text-gray-600">
              {index + 1}
            </span>
            <div>
              <h2 className="font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/bang-gia" className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
          Xem bảng giá
        </Link>
        <Link to="/vung-phuc-vu" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-semibold hover:bg-gray-50">
          Kiểm tra vùng phục vụ
        </Link>
      </div>
    </div>
  );
}
