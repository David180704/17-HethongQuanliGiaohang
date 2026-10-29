# Kiểm thử theo story — Sprint 1 đến Sprint 5

> Sinh tự động ngày 29/10/2026 bởi `npm run report:stories` (thư mục `code/apps/api`).
> Chạy lại lệnh này sau mỗi lần sửa code để cập nhật. Chạy riêng một story:
> `npm run test:story -- 6` (story US-06).

## Tổng quan

| | Số story |
|---|---|
| 🟢 Đạt (mọi tiêu chí có test và pass) | 20 |
| 🔴 Lỗi (có test fail) | 0 |
| ⚪ Chưa làm (chưa có code, tiêu chí ghi dạng todo) | 14 |

Điểm story đạt: **63/112** điểm của Sprint 1–5.

| Sprint | Story đạt | Điểm đạt |
|---|---|---|
| Sprint 1 | 4/4 | 16/16 |
| Sprint 2 | 9/9 | 24/24 |
| Sprint 3 | 6/6 | 21/21 |
| Sprint 4 | 1/8 | 2/26 |
| Sprint 5 | 0/7 | 0/25 |

## Chi tiết từng story

Cột *Test API* = số test pass / tổng số test của story (nhãn `[US-xx]` trong tên test).
Cột *Kiểm thử giao diện* là các kịch bản Playwright (Web Khách hàng, App Nhân viên, App Khách
hàng) và Maestro trên máy ảo Android (NV = App Nhân viên, KH = App Khách hàng) đã chạy — cần bật
server nên không nằm trong lệnh này.

| Sprint | Story | Tên | Điểm | Kết quả | Test API | Kiểm thử giao diện |
|---|---|---|---|---|---|---|
| 1 | US-01 | Khởi tạo dự án, môi trường Docker và quy ước mã nguồn | 3 | 🟢 Đạt | 4/4 |  |
| 1 | US-02 | Thiết kế mô hình dữ liệu và sơ đồ lớp hệ thống | 5 | 🟢 Đạt | 18/18 |  |
| 1 | US-03 | Xây dựng khung xác thực JWT và phân quyền theo vai trò | 5 | 🟢 Đạt | 5/5 |  |
| 1 | US-04 | Chuẩn hóa response, mã lỗi và tài liệu Swagger | 3 | 🟢 Đạt | 6/6 |  |
| 2 | US-05 | Thiết lập CI pipeline tự động kiểm thử và build | 2 | 🟢 Đạt | 1/1 |  |
| 2 | US-06 | Đăng nhập hệ thống | 2 | 🟢 Đạt | 12/12 | Web + App KH: từ chối tài khoản nhân viên, sai mật khẩu · App NV: sai mật khẩu · Maestro NV 02, KH 04, 05 |
| 2 | US-07 | Đăng ký tài khoản khách hàng | 3 | 🟢 Đạt | 4/4 | Web + App KH: đăng ký doanh nghiệp, email trùng · Maestro KH 06 (cá nhân), 07 (doanh nghiệp) |
| 2 | US-08 | Đăng xuất khỏi hệ thống | 1 | 🟢 Đạt | 4/4 | Web + App NV + App KH: đăng xuất · Maestro NV 07, KH 08 |
| 2 | US-09 | Phân quyền truy cập theo vai trò | 3 | 🟢 Đạt | 9/9 | Web: guard ngược · App NV: kho/tài xế không thấy menu quản trị · Maestro NV 04, 05 |
| 2 | US-10 | Quản lý tài khoản người dùng trong hệ thống | 3 | 🟢 Đạt | 4/4 | App NV: form người dùng · Liên thiết bị: khóa/mở tài khoản (máy ảo ↔ web, cả hai chiều) |
| 2 | US-11 | Quản lý danh mục tuyến và khu vực phục vụ | 3 | 🟢 Đạt | 3/3 | App NV: CRUD khu vực · Maestro NV 06 · Liên app + liên thiết bị (cả hai chiều) |
| 2 | US-12 | Quản lý danh mục loại dịch vụ vận chuyển | 2 | 🟢 Đạt | 3/3 | App NV: chặn trùng mã dịch vụ |
| 2 | US-13 | Quản lý bảng giá vận chuyển theo khu vực và khối lượng | 5 | 🟢 Đạt | 12/12 | App NV: lưới bậc khối lượng, báo chồng lấn và trùng khoảng hiệu lực ngay trên form |
| 3 | US-14 | Quản lý danh mục điểm tập kết và bưu cục | 2 | 🟢 Đạt | 8/8 | App NV: mở hub và bưu cục trực thuộc, chặn quận/huyện ngoài vùng phục vụ, tuyến chọn hub từ danh mục · Maestro NV 03 |
| 3 | US-15 | Quản lý danh sách địa điểm lấy hàng | 3 | 🟢 Đạt | 9/9 | Web + App KH: thêm địa điểm (gợi ý quận/huyện), chặn ngoài vùng phục vụ, đặt mặc định, xóa |
| 3 | US-16 | Ước tính phí vận chuyển trước khi gửi hàng | 3 | 🟢 Đạt | 7/7 | Web + App KH: ước tính phí → Gửi hàng → đăng ký tài khoản mới → tạo đơn điền sẵn dữ liệu · Maestro KH 09* |
| 3 | US-17 | Xem phí vận chuyển dự kiến trước khi xác nhận đơn | 5 | 🟢 Đạt | 11/11 | Web + App KH: bước xác nhận tách từng khoản phí, phí tạo đơn bằng phí đã ước tính · Liên app: phí khóa khi kho duyệt |
| 3 | US-18 | Tạo đơn hàng giao mới | 5 | 🟢 Đạt | 7/7 | Web + App KH: tạo đơn 4 bước, chặn bước sai · App NV: kho duyệt đơn, hub khác không thấy · Liên app Web → App NV · Maestro KH 09*, NV 08* |
| 3 | US-19 | Khai báo tiền thu hộ COD và hình thức thanh toán phí | 3 | 🟢 Đạt | 6/6 | Web + App KH: thu hộ, 3 hình thức trả phí, khấu trừ chỉ khi bật thu hộ, thu hộ nhỏ hơn phí thì không cho xác nhận |
| 4 | US-20 | Xem chi tiết đơn hàng và toàn bộ hành trình | 2 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 4 | US-21 | Hàng đợi sự kiện và consumer ghi nhật ký hành trình đơn | 5 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 4 | US-22 | Tra cứu hành trình đơn hàng bằng mã vận đơn | 3 | ⚪ Chưa làm | 0/0 · còn 2 tiêu chí |  |
| 4 | US-23 | Quản lý ca làm việc và phân công nhân viên vào tuyến | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 4 | US-24 | Cấu hình năng lực xử lý tối đa của người giao hàng | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 4 | US-25 | Phân công đơn lấy hàng cho người giao hàng | 5 | ⚪ Chưa làm | 0/0 · còn 2 tiêu chí |  |
| 4 | US-26 | Đăng nhập ứng dụng di động | 2 | 🟢 Đạt | 3/3 | Maestro NV 01–07 trên máy ảo Android · App NV: 17 kịch bản |
| 4 | US-27 | Xem danh sách đơn cần lấy trong ca làm việc | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-28 | Xác nhận đã lấy hàng từ người gửi | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-29 | Quản lý điểm check-in trên bản đồ | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-30 | Tự động check-in vị trí khi đi qua điểm đã cài đặt | 5 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-31 | Xem danh sách đơn cần giao trong ca làm việc | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-32 | Xác nhận giao hàng thành công cho người nhận | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-33 | Ghi nhận đã thu tiền COD từ người nhận | 3 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |
| 5 | US-34 | Tạo đối soát và tổng hợp số liệu cho khách hàng | 5 | ⚪ Chưa làm | 0/0 · còn 1 tiêu chí |  |

## Ngoài Sprint Backlog

| Mã | Nội dung | Kết quả | Test API | Kiểm thử giao diện |
|---|---|---|---|---|
| PB-01 | Khách vãng lai xem dịch vụ và vùng phục vụ (Product Backlog #1) | 🟢 Đạt | 7/7 | Web + App KH: trang chủ, vùng phục vụ, tìm không dấu · Maestro KH 01, 03 |
| PB-04 | Khách vãng lai xem bảng giá theo khu vực (Product Backlog #4) | 🟢 Đạt | 2/2 | Web + App KH: bảng giá đổi theo dịch vụ · Maestro KH 02 |
| CACHE | Cache 30 giây: dữ liệu cloud cache xuống Redis, app không gọi API liên tục | 🟢 Đạt | 8/8 | Web: đếm request (1 lần/30 giây), tự làm mới sau 30 giây, đổi tài khoản không lộ hồ sơ người trước |

## Lưu ý cho Sprint Review

- Lịch lấy từ docs/PERT_ToanDuAn.docx: Sprint 2 kéo dài đến 30/10/2026 để xong đủ 9 story (gồm US-13).
  Cả 9 story Sprint 2 xong ngày 29/10/2026 nên Sprint 3 (US-14 → US-19) bắt đầu ngay 29/10/2026,
  sớm hơn lịch PERT (02/11/2026). Story chỉ ghi "Done" khi chuyển sang 🟢 Đạt ở bảng trên.
- Thứ tự thực tế Sprint 3: T4 (lõi tính phí US-17) làm trước T3 vì API ước tính phí (US-16) dùng nó;
  API thu hộ (T7, US-19) làm trước màn hình tạo đơn (T6) để màn hình có đủ luật thu hộ.
- \* Flow Maestro KH 09 và NV 08 đã viết nhưng chưa chạy trên máy ảo: máy dev chỉ còn khoảng 3 GB
  bộ nhớ ảo, bật máy ảo dễ làm sập tiến trình. Cùng mã nguồn đã chạy bằng Playwright (bản web).
- US-26 (Sprint 4) đã xong sớm cùng App Nhân viên.
- US-05 (CI) chỉ kiểm tra được file workflow có đủ bước lint → test → build; kết quả chạy
  thật xem trên tab Actions của GitHub.
