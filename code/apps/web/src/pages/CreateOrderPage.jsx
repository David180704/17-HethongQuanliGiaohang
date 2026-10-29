import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tạo đơn hàng</h1>
      <p className="mt-1 text-gray-600">
        Đang đăng nhập: <span className="font-semibold text-gray-800">{user.fullName}</span>
      </p>

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
