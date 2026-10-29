import { Link } from "react-router-dom";
import { useCachedQuery } from "../lib/useCachedQuery.js";
import { formatSurcharge } from "../lib/format.js";

const STEPS = [
  { title: "Tạo đơn", text: "Nhập người nhận, hàng hóa, chọn dịch vụ. Phí tính ngay theo bảng giá." },
  { title: "Lấy hàng", text: "Hệ thống tự phân công tài xế đúng tuyến đến lấy tận nơi." },
  { title: "Vận chuyển", text: "Theo dõi từng chặng qua mã vận đơn EXP." },
  { title: "Giao & thu hộ", text: "Giao tận tay, thu COD và đối soát định kỳ cho shop." },
];

export default function HomePage() {
  // Du lieu cong khai (khong can dang nhap), cache 30 giay va tu lam moi
  const typesQuery = useCachedQuery("/public/service-types");
  const areasQuery = useCachedQuery("/public/service-areas");
  const serviceTypes = typesQuery.data || [];
  const areas = areasQuery.data || [];
  const error =
    typesQuery.error || areasQuery.error ? "Không tải được dữ liệu từ máy chủ. Vui lòng thử lại sau." : "";

  const provinceCount = new Set(areas.map((a) => a.province)).size;

  return (
    <div>
      <section className="bg-linear-to-br from-brand-600 via-brand-500 to-orange-400 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:items-center md:py-16">
          <div>
            <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">Gửi hàng toàn quốc, theo dõi từng chặng</h1>
            <p className="mt-3 max-w-xl text-white/90">
              Xem giá và vùng phục vụ không cần đăng nhập. Chỉ khi tạo đơn và thanh toán bạn mới cần tài khoản.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tao-don"
                className="rounded-lg bg-white px-5 py-3 font-semibold text-brand-600 shadow hover:bg-brand-50"
              >
                Tạo đơn ngay
              </Link>
              <Link to="/bang-gia" className="rounded-lg border border-white/60 px-5 py-3 font-semibold hover:bg-white/10">
                Xem bảng giá
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 text-gray-900 shadow-lg">
            <h2 className="font-semibold">Tra cứu vận đơn</h2>
            <p className="mt-1 text-sm text-gray-500">Nhập mã vận đơn dạng EXP + 10 chữ số.</p>
            <div className="mt-4 flex gap-2">
              <input
                disabled
                aria-label="Mã vận đơn"
                placeholder="EXP0000000001"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              />
              <button disabled className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500">
                Tra cứu
              </button>
            </div>
            <p className="mt-3 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Sắp có · #22 · Sprint 4
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section>
          <h2 className="text-xl font-bold">Dịch vụ</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {serviceTypes.map((type) => (
              <article key={type.code} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
                    Dự kiến {type.estimatedDays} ngày
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{formatSurcharge(type.surchargeRate)}</p>
                <Link to="/bang-gia" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
                  Xem giá chi tiết
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat value={areas.length || "—"} label="quận/huyện đang phục vụ" />
          <Stat value={provinceCount || "—"} label="tỉnh/thành phố" />
          <Stat value="20 triệu ₫" label="thu hộ COD tối đa mỗi đơn" />
          <Stat value="3 cách" label="trả phí: shop trả, người nhận trả, trừ vào COD" />
        </section>

        <section>
          <h2 className="text-xl font-bold">Gửi hàng trong 4 bước</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col items-start gap-3 rounded-2xl bg-brand-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Không chắc địa chỉ có được giao?</h2>
            <p className="text-sm text-gray-600">Tra cứu quận/huyện trong vùng phục vụ trước khi gửi.</p>
          </div>
          <Link to="/vung-phuc-vu" className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
            Kiểm tra vùng phục vụ
          </Link>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-2xl font-extrabold text-brand-600">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{label}</p>
    </div>
  );
}
