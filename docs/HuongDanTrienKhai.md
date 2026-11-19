# Hướng dẫn triển khai EDMS lên máy chủ và điện thoại thật

Sprint 7 · US-44 (VNPay), US-45 (máy chủ), US-46 (hai trang web riêng), US-47 (app trên điện thoại thật).
Cập nhật 19/11/2026.

## 0. Sau khi làm xong, hệ thống gồm

| Thành phần | Địa chỉ | Dùng cho |
|---|---|---|
| API + Swagger | `https://edms17-api.onrender.com` · `/api-docs` | Mọi ứng dụng gọi vào đây |
| Web Khách hàng | `https://edms17-web.onrender.com` | Khách vãng lai, khách hàng, shop |
| Web Nhân viên | `https://edms17-nhanvien.onrender.com` | Admin, nhân viên kho, tài xế |
| App Khách hàng (Android) | CH Play — kênh thử nghiệm nội bộ, hoặc link APK của Expo | Khách hàng, shop |
| App Nhân viên (Android) | CH Play — kênh thử nghiệm nội bộ, hoặc link APK của Expo | Admin, nhân viên kho, tài xế |
| CSDL | MongoDB Atlas (bạn đang quản lý) | |
| Cổng thanh toán | VNPay sandbox (môi trường thử, không trừ tiền thật) | |

Hai nền tảng (web, di động) đều có bản cho nhân viên và bản cho khách. Tài khoản nhân viên đăng nhập vào
bản khách (và ngược lại) bị từ chối với thông báo "Tài khoản này không dùng được ứng dụng này".

Tên `edms17-...` có thể đã có người dùng. Nếu Render báo trùng tên, đổi tên trong `render.yaml` (và các địa
chỉ đi kèm: `CORS_ORIGIN`, `PUBLIC_API_URL`, `VITE_API_URL`, `VITE_STAFF_APP_URL`, `EXPO_PUBLIC_API_URL`, cả
`eas.json` của hai app), sau đó chạy lại `npm test` trong `code/apps/api`. Test `deploy.test.js` kiểm các địa chỉ
này có khớp nhau không.

## 1. MongoDB Atlas (5 phút)

1. **Network Access** → Add IP Address → `0.0.0.0/0` (Allow access from anywhere). Gói miễn phí của Render không
   có IP cố định nên không giới hạn theo IP được. Đặt mật khẩu user CSDL đủ mạnh.
2. Cập nhật cấu trúc: từ Sprint 7 có thêm collection `payments` (17 collection). Trong mongosh / Compass:
   `load("code/database/01-tao-cau-truc.mongodb.js")`, sau đó `02-du-lieu-mau.mongodb.js` nếu muốn nạp lại dữ liệu mẫu.
   File 01 chạy lại nhiều lần vẫn an toàn (chỉ cập nhật ràng buộc, không xóa dữ liệu).

## 2. VNPay sandbox (10 phút, nhận email ngay)

1. Đăng ký tại <https://sandbox.vnpayment.vn/devreg/>. Email trả về có **vnp_TmnCode** và **vnp_HashSecret**.
2. Sau khi API đã chạy (bước 3): vào trang quản trị merchant sandbox <https://sandbox.vnpayment.vn/merchantv2/>,
   mục cấu hình IPN, nhập `https://edms17-api.onrender.com/payments/vnpay/ipn`.
3. Thanh toán thử bằng thẻ test VNPay công bố cho sandbox: ngân hàng **NCB**, số thẻ `9704198526191432198`,
   tên `NGUYEN VAN A`, ngày phát hành `07/15`, OTP `123456`.

Không có IPN (chưa cấu hình, hoặc API đang ngủ) vẫn ghi nhận được, vì trang return cũng kiểm chữ ký rồi ghi kết
quả. Cả hai đường chỉ ghi **một lần** cho mỗi giao dịch.

## 3. Render (15 phút + 5–10 phút build)

1. Đăng nhập <https://render.com> bằng GitHub, cấp quyền repo `17-HethongQuanliGiaohang`.
2. **New → Blueprint** → chọn repo. Render đọc `render.yaml` ở thư mục gốc và tạo 4 dịch vụ.
3. Render hỏi các biến `sync: false`, bạn nhập:
   - `MONGO_URI`: chuỗi kết nối Atlas (dạng `mongodb+srv://...`). Không ghi chuỗi này vào git.
   - `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`: lấy từ email VNPay.
4. **Apply**. Đợi `edms17-api` báo *Live*, rồi mở `https://edms17-api.onrender.com/health`, kết quả phải là `{"success":true,...}`.
   Thiếu hoặc sai cấu hình thì API **không khởi động**; Logs ghi rõ thiếu biến nào (US-45).
5. Mở hai trang web và đăng nhập bằng tài khoản test (mật khẩu `123456`, nếu Atlas đã nạp dữ liệu mẫu).

Hiện Render triển khai từ nhánh `sprint-7`. Sau khi bạn merge vào `main`, sửa `branch: sprint-7` thành
`branch: main` trong `render.yaml`. Từ đó mỗi lần push, Render tự build lại.

**Gói miễn phí:** API ngủ sau 15 phút không có ai dùng, lần mở đầu tiên chờ khoảng 1 phút. Trước buổi demo, mở
`/health` trước 1–2 phút. Redis miễn phí không lưu bền: khởi động lại thì mất cache và hàng đợi, nhưng dữ liệu
nghiệp vụ nằm trong Atlas nên không mất.

## 4. App trên điện thoại thật — Expo EAS (20 phút, build trên máy chủ Expo)

Làm lần lượt cho `code/apps/customer-mobile` và `code/apps/staff`:

```bash
npx eas-cli login                 # tài khoản Expo (miễn phí)
npx eas-cli init                  # tạo project, ghi projectId vào app.json — commit thay đổi này
npx eas-cli build -p android --profile preview      # APK: cuối build có link + mã QR để cài
npx eas-cli build -p android --profile production   # AAB: để tải lên CH Play
```

- `eas.json` của mỗi app đã đặt `EXPO_PUBLIC_API_URL=https://edms17-api.onrender.com`, nên app cài vào máy thật
  gọi thẳng API trên Render, không cần chung mạng Wi-Fi với máy dev.
- Tên gói (không đổi được sau khi đã lên CH Play): `vn.edms17.khachhang`, `vn.edms17.nhanvien`.
- Cài APK: mở link trên điện thoại, cho phép "Cài ứng dụng không rõ nguồn gốc".
- App Khách hàng thanh toán VNPay: mở trang VNPay ngay trong app. Thanh toán xong, VNPay chuyển về `edmskh://thanh-toan`,
  app tự đóng trình duyệt và hiện kết quả trên chi tiết đơn.

## 5. CH Play — kênh thử nghiệm nội bộ (lần đầu 1–3 ngày vì phải xác minh danh tính)

1. Tạo tài khoản <https://play.google.com/console> (phí một lần 25 USD, chọn loại **Cá nhân**), xác minh danh tính.
2. **Tạo ứng dụng** cho từng app: tên "EDMS Khách hàng" / "EDMS Nhân viên", Ứng dụng, Miễn phí.
3. **Kiểm thử → Thử nghiệm nội bộ → Tạo bản phát hành**, tải lên file `.aab` của bước 4 (lần đầu tải bằng tay;
   những lần sau có thể dùng `npx eas-cli submit -p android --profile production`, cần khóa service account của Google Cloud).
4. Khai báo bắt buộc (mục *Nội dung ứng dụng*):
   - Chính sách quyền riêng tư: `https://edms17-web.onrender.com/chinh-sach-quyen-rieng-tu`
   - An toàn dữ liệu: thu thập họ tên, email, số điện thoại, địa chỉ (để giao hàng); dữ liệu mã hóa khi truyền;
     không chia sẻ với bên thứ ba để quảng cáo; người dùng yêu cầu xóa qua quản trị viên.
   - Quyền truy cập ứng dụng: cung cấp tài khoản thử cho người kiểm duyệt (vd `khach1@edms.vn` / `123456`,
     `kho1@edms.vn` / `123456`).
   - Phân loại nội dung, đối tượng mục tiêu (18+), quảng cáo: không.
5. **Người thử nghiệm**: thêm danh sách email (tối đa 100), gửi họ **link tham gia**. Họ cài app từ CH Play như app thường.

Muốn phát hành công khai (ai cũng tìm thấy trên CH Play) thì tài khoản cá nhân mới phải chạy thử kín với ít nhất
12 người trong 14 ngày liên tục rồi mới xin lên production. Không cần cho đồ án.

## 6. Lỗi hay gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Web mở được nhưng báo "Không kết nối được máy chủ" | API đang ngủ (đợi ~1 phút), hoặc `CORS_ORIGIN` thiếu địa chỉ web |
| API không lên, log "Cau hinh chay that chua dung" | Thiếu `MONGO_URI` / `PUBLIC_API_URL` / `CORS_ORIGIN` đúng dạng `https://` |
| `MongoServerSelectionError` | Atlas chưa mở `0.0.0.0/0`, hoặc sai mật khẩu trong `MONGO_URI` |
| Thanh toán báo "Cổng thanh toán VNPay chưa được cấu hình" | Chưa nhập `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` trên Render |
| VNPay báo "Sai chữ ký" | `VNPAY_HASH_SECRET` chép thiếu ký tự hoặc có khoảng trắng |
| Kho bấm duyệt đơn báo "chưa thanh toán phí vận chuyển qua VNPay" | Đúng luật US-44: khách thanh toán xong mới duyệt được |

## 7. Chạy thử trên máy dev (không cần tài khoản nào)

```bash
cd code/apps/api && MONGO_URI="mongodb://localhost:27018/edms?directConnection=true" \
  VNPAY_TMN_CODE=EDMSDEV VNPAY_HASH_SECRET=edms-dev-hash-secret npm run dev
```

Playwright giả lập trang VNPay: chặn địa chỉ `sandbox.vnpayment.vn` rồi trả về kết quả đã ký bằng cùng hash secret.
Xem `apps/web/tests-e2e/create-order.spec.js` và `apps/customer-mobile/tests-e2e/create-order.spec.js`, test `[US-44]`.
