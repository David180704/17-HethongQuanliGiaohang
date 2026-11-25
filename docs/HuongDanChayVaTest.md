# Hướng dẫn chạy và kiểm thử EDMS

Áp dụng cho nhánh `sprint-5` (12/11/2026). Mọi lệnh chạy trong PowerShell, bắt đầu ở thư mục `QuanLiGiaoHang`.

| Ứng dụng | Địa chỉ | Ai dùng |
|---|---|---|
| Web Khách hàng | http://localhost:5173 | Khách cá nhân, shop, người nhận tra cứu |
| Web Nhân viên (bản web của App Nhân viên) | http://localhost:8082 | Admin, nhân viên kho, tài xế |
| App Nhân viên trên điện thoại | Máy ảo Android, mở bằng Expo Go | Như trên |
| App Khách hàng mobile (bản web) | http://localhost:8083 | Khách |
| API, Swagger | http://localhost:4044/api-docs | Kiểm tra API |

Web Nhân viên và App Nhân viên là **cùng một mã nguồn** (`code/apps/staff`): mở bằng trình duyệt thì là web,
mở trên máy ảo thì là app.

## 1. Chạy chương trình

### Cách nhanh: một lệnh

```powershell
powershell -ExecutionPolicy Bypass -File .\code\chay-demo.ps1             # cả máy ảo
powershell -ExecutionPolicy Bypass -File .\code\chay-demo.ps1 -NoEmulator # chỉ web, nhẹ hơn
```

Script tự bật Docker (MongoDB, Redis), tắt server cũ, mở khóa tài khoản, mở 3 cửa sổ API, Web Khách hàng,
App Nhân viên và bật máy ảo. Thấy chữ **SAN SANG** là dùng được.

- Script **không** bật App Khách hàng mobile. Cần thì mở thêm: `cd code\apps\customer-mobile; npm start`.
- Máy ảo khởi động lạnh có thể mất khoảng 6 phút. Khi máy ảo đã lên, bấm phím `a` trong cửa sổ
  "EDMS App Nhan vien" để mở app.

### Cách bật từng phần

Mỗi lệnh một cửa sổ, theo đúng thứ tự. Docker Desktop phải đang chạy.

```powershell
cd code; docker compose up -d                                                                         # 1. MongoDB + Redis
cd code\apps\api; $env:MONGO_URI="mongodb://localhost:27018/edms?directConnection=true"; npm run dev   # 2. API :4044
cd code\apps\web; npm run dev -- --host --port 5173 --strictPort                                       # 3. Web Khách hàng
cd code\apps\staff; npm start                                                                          # 4. Nhân viên :8082
cd code\apps\customer-mobile; npm start                                                                # 5. (tùy chọn) :8083
```

Mở http://localhost:4044/health: phải thấy `"cloud":false` (đang dùng CSDL local).

### Tắt

Đóng các cửa sổ "EDMS ...". Tắt máy ảo: `D:\DevTools\android-sdk\platform-tools\adb.exe emu kill`.

## 2. Tài khoản

| Dùng ở | Tài khoản (đuôi `@edms.vn`) | Mật khẩu |
|---|---|---|
| Web Khách hàng | `khach1` … `khach6`, `shop1` … `shop3` | `123456` |
| Nhân viên | `admin`, `kho1` (Hub Hà Nội), `kho2` (Hub HCM), `kho3` (Bưu cục Đà Nẵng), `taixe1` … `taixe5` | `123456` |
| Demo theo vùng | kho `khohn`, `khohcm`, `khodn`; shipper `shiphn1`, `shiphn2`, `shiphcm`, `shipdn` | `123123` |

- Tài khoản demo theo vùng có sẵn "Ca test" hôm nay và ngày mai, nên đơn vừa duyệt **tự phân công** cho shipper.
  Tạo lại tài khoản và ca: `cd code\apps\api; npm run accounts:demo` (API phải đang chạy).
- Nhập sai mật khẩu 5 lần thì bị khóa 15 phút. Mở khóa: `cd code\apps\api; npm run unlock -- --local`.

## 3. Kiểm thử bằng tay

Mỗi vai mở **một trình duyệt riêng** (Chrome, Edge, cửa sổ ẩn danh): các tab cùng trình duyệt dùng chung phiên
đăng nhập.

### Luồng chính: khách tạo đơn → kho duyệt → shipper lấy → nhập kho → tra cứu

| Bước | Vai, ở đâu | Làm gì | Kết quả đúng |
|---|---|---|---|
| 1 | `shop1`, Web Khách hàng | Ước tính phí; Tạo đơn qua 4 bước, nơi lấy hàng ở Hà Nội | Có mã `EXP…`, trạng thái "Chờ bưu cục xác nhận" |
| 2 | `khohn`, Web Nhân viên | Duyệt đơn → chọn đơn → Xác nhận | Phí bị khóa; đơn tự phân công cho shipper Hà Nội |
| 3 | `khohn`, mục **Phân công** | Xem hàng chờ, tải theo ca, nút năng lực mỗi ca | Đơn gửi nhanh nằm đầu, nhãn "Gửi nhanh · ưu tiên" |
| 4 | `shiphn1`, App hoặc Web Nhân viên | Vị trí & check-in; Đơn cần lấy → lấy thành công | Chỉ thấy điểm check-in đã đăng ký (Hub Hà Nội) |
| 5 | `khohn` | Nhập kho, xuất kho | Trạng thái đơn đổi theo từng bước |
| 6 | Không đăng nhập, Web Khách hàng → Tra cứu | Nhập mã `EXP…` | Mốc hành trình, điểm đã đi qua, số người nhận bị che |

### Các luồng nên thử thêm

- **Tiếp nhận tại quầy** (`kho1`): tìm khách theo số điện thoại, không có thì tạo khách lẻ, báo giá, tạo đơn —
  đơn vào thẳng trạng thái tại kho.
- **Chặn sai vùng** (`admin` → Người dùng → sửa tài xế): gán cả tuyến Hà Nội lẫn tuyến HCM, hoặc điểm check-in
  khác vùng → bị báo lỗi.
- **Check-in sai chỗ** (tài xế): check-in ở điểm khác điểm đã đăng ký → bị từ chối kèm thông báo.
- **Đăng nhập nhiều tab** (Web Khách hàng): đăng xuất ở tab A, tab B đang ở Tạo đơn tự về trang đăng nhập.
- **Khách**: địa điểm lấy hàng (tối đa 10, một mặc định), Đơn hàng của tôi, tài khoản nhận thu hộ.

## 4. Kiểm thử tự động

### Trước khi chạy

1. Các server ở mục 1 đang chạy, API dùng CSDL local.
2. **Gỡ ca demo**, nếu không các test chờ đơn "đã duyệt" sẽ đỏ (đơn bị tự phân công mất):

   ```powershell
   cd code\apps\api; npm run accounts:demo -- --xoa-ca
   ```

### Chạy (tuần tự, mỗi lần một bộ)

| Bộ | Lệnh | Cần server | Kết quả gần nhất |
|---|---|---|---|
| API | `cd code\apps\api; npm test` | Docker | 218 pass (~40 giây) |
| Web Khách hàng | `cd code\apps\web; npx playwright test --workers=2` | 4044, 5173 | 26 pass |
| Nhân viên | `cd code\apps\staff; npx playwright test` | 4044, 5173, 8082 | 27 pass |
| Khách hàng mobile | `cd code\apps\customer-mobile; npx playwright test` | 4044, 8083 | 13 pass |
| Máy ảo (Maestro) | `cd code; powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App staff` (rồi `-App customer`) | 4044, 8082, 8083, máy ảo | NV 13/13, KH 12/12 (~25 phút) |

Vài test liên thiết bị tự bỏ qua khi thiếu app kia — không phải lỗi.

### Chạy một phần

```powershell
cd code\apps\api; npm run test:story -- 40                    # mọi test của một story
cd code\apps\web; npx playwright test create-order.spec.js    # một file
cd code\apps\staff; npx playwright test checkin.spec.js
cd code; powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App staff -Flow 13-tai-xe-check-in
npx playwright show-report                                     # báo cáo HTML (chạy trong thư mục app)
```

| App | File test |
|---|---|
| Web Khách hàng | `smoke`, `auth-tabs`, `estimate-draft`, `create-order`, `orders`, `pickup-locations`, `tracking`, `bank-account`, liên app (`cross-app`, `order-cross-app`, `mobile-cross`) |
| Nhân viên | `staff`, `counter`, `shifts`, `capacity`, `assign`, `pickup`, `warehouse`, `checkin` |
| Khách hàng mobile | `customer`, `create-order`, `orders`, `pickup-locations`, `tracking`, `cross-device` |
| Maestro | NV 01–13, KH 01–12 (`code/apps/*/.maestro`); báo cáo trong `maestro-report` của từng app |

### Sau khi chạy

Bật lại ca demo để test tay tiếp: `cd code\apps\api; npm run accounts:demo`.

## 5. Lỗi hay gặp

| Hiện tượng | Xử lý |
|---|---|
| Đăng nhập báo tài khoản bị khóa | `cd code\apps\api; npm run unlock -- --local` |
| Test chờ đơn "đã duyệt" đỏ (ví dụ US-18) | Còn ca mở: `npm run accounts:demo -- --xoa-ca` |
| Tra cứu báo 429 | Giới hạn 20 lần/phút mỗi máy; đợi 1 phút |
| Lệnh báo `fetch failed` / `ECONNRESET` | API vừa tự khởi động lại (`npm run dev` theo dõi file); đợi vài giây rồi chạy lại |
| Lệnh docker báo `dockerDesktopLinuxEngine` | Docker Desktop chưa bật; mở Docker Desktop, đợi khoảng 1 phút |
| Máy ảo không lên, app tự tắt | Kiểm bộ nhớ ảo trống: `(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1MB` — dưới ~6 GB thì đóng bớt chương trình hoặc chỉ demo bằng web |
| Dữ liệu thử lộn xộn | `cd code\apps\api; npm run seed:local` (nạp lại dữ liệu mẫu), rồi `npm run accounts:demo` |
