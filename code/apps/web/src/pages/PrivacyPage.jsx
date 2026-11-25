// Chinh sach quyen rieng tu (US-47): CH Play bat buoc moi ung dung co duong dan cong khai toi trang nay.
// Dung chung cho Web Khach hang, App Khach hang va App Nhan vien.
const SECTIONS = [
  {
    title: "1. Dữ liệu chúng tôi thu thập",
    items: [
      "Thông tin tài khoản: họ tên, email, số điện thoại, tên cửa hàng và mã số thuế (tài khoản doanh nghiệp).",
      "Thông tin gửi hàng: địa chỉ lấy hàng, tên, số điện thoại và địa chỉ người nhận, mô tả hàng hóa, tiền thu hộ.",
      "Tài khoản ngân hàng nhận tiền thu hộ (do khách tự khai báo) để đối soát và chi trả.",
      "Với nhân viên giao hàng: tọa độ tại thời điểm xác nhận lấy hàng, giao hàng và check-in (do ứng dụng gửi khi nhân viên thao tác).",
    ],
  },
  {
    title: "2. Mục đích sử dụng",
    items: [
      "Tạo và vận chuyển đơn hàng, tính phí, thu hộ và đối soát tiền với người gửi.",
      "Cho người nhận tra cứu hành trình đơn bằng mã vận đơn (trang tra cứu không hiển thị số điện thoại, địa chỉ chi tiết).",
      "Xử lý sự cố, khiếu nại và thống kê vận hành nội bộ.",
    ],
  },
  {
    title: "3. Thanh toán",
    items: [
      "Thanh toán phí vận chuyển online được thực hiện trên trang của cổng VNPay. EDMS không nhận và không lưu số thẻ; chỉ lưu mã giao dịch, số tiền và kết quả do VNPay trả về.",
    ],
  },
  {
    title: "4. Lưu trữ và chia sẻ",
    items: [
      "Dữ liệu lưu trên máy chủ cơ sở dữ liệu đám mây (MongoDB Atlas), kết nối được mã hóa. Mật khẩu được băm, không lưu dạng đọc được.",
      "Chỉ chia sẻ thông tin cần thiết cho nhân viên tham gia giao nhận đơn hàng và cổng thanh toán VNPay; không bán dữ liệu cho bên thứ ba.",
    ],
  },
  {
    title: "5. Quyền của bạn",
    items: [
      "Xem và sửa thông tin tài khoản, địa điểm lấy hàng, tài khoản ngân hàng trong mục Tài khoản.",
      "Yêu cầu khóa hoặc xóa tài khoản bằng cách liên hệ quản trị viên; dữ liệu đơn hàng đã phát sinh được giữ để đối soát theo quy định kế toán.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Chính sách quyền riêng tư</h1>
      <p className="mt-2 text-sm text-gray-500">
        Áp dụng cho Web Khách hàng, ứng dụng EDMS Khách hàng và EDMS Nhân viên · cập nhật 19/11/2026
      </p>
      <p className="mt-4 text-gray-700">
        EDMS Express là hệ thống quản lý giao hàng xây dựng trong đồ án môn Công nghệ phần mềm nâng cao. Trang này mô tả dữ liệu hệ thống thu thập và
        cách sử dụng.
      </p>
      {SECTIONS.map((section) => (
        <section key={section.title} aria-label={section.title} className="mt-6">
          <h2 className="font-semibold">{section.title}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
