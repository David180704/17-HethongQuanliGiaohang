# Yêu cầu thay đổi sau buổi dùng thử — 12/11/2026

Product Owner dùng thử hệ thống (Web Khách hàng, App Nhân viên) sau Sprint 5 và đưa ra các góp ý dưới đây.
Mỗi góp ý được tách thành: **đã làm ngay** (có code, test, commit trên nhánh `sprint-5`) hoặc **đưa vào kế hoạch**
vì đổi cấu trúc nghiệp vụ — sửa vội trước buổi demo dễ làm hỏng phần đang chạy tốt (hơn 200 test, bảng giá, dữ
liệu mẫu).

## 1. Đã làm ngay (12/11/2026)

| # | Góp ý | Đã sửa | Kiểm chứng |
|---|---|---|---|
| 1 | Đã đăng nhập mà tạo đơn vẫn bắt đăng nhập (giao diện khách) | Nguyên nhân: các tab Web cùng trình duyệt dùng chung phiên. Tab này đăng xuất / đổi tài khoản / làm mới token thì tab kia vẫn hiện "đã đăng nhập" nhưng token đã đổi → bấm Tạo đơn bị đẩy về đăng nhập. Sửa: đồng bộ đăng nhập giữa các tab; hai tab cùng làm mới token thì tab chậm dùng token mới của tab kia thay vì đăng xuất | Playwright `auth-tabs.spec.js` (thiếu bản sửa thì test đỏ) |
| 2 | Sửa "Năng lực mỗi ca" thành "Phân công" | Trang chủ kho chỉ còn một mục **Phân công** (hàng chờ, tải theo ca, phân công tay); năng lực mỗi ca là nút trong mục này. Admin: mục **Phân công** (năng lực mặc định) | Playwright `capacity`, `assign`, `pickup`; Maestro NV 10 |
| 3 | Năng lực / phân công phải khớp thông tin, tránh shipper Hà Nội bị phân vận hàng ở Sài Gòn | Một tài xế chỉ phụ trách các tuyến **cùng một hub** (hub + bưu cục trực thuộc); ca làm việc và phân công đã bắt tài xế phải thuộc tuyến — nay chặn luôn từ lúc gán tuyến. Điểm check-in của tài xế cũng phải cùng vùng với tuyến | Test API `[US-25] khop vung` |
| 4 | Mỗi người chỉ một điểm check-in hợp lệ, không đúng thì không nhận | Admin gán **một điểm check-in đăng ký** cho mỗi tài xế; check-in ngoài bán kính điểm đó hoặc check-in tay ở điểm khác đều bị từ chối, có thông báo; app tài xế chỉ hiện điểm của mình. Dữ liệu mẫu: tài xế Hà Nội → Hub Hà Nội, liên tỉnh phía Bắc → Trạm QL1A Ninh Bình, HCM → Hub HCM, Đà Nẵng → Bưu cục Đà Nẵng | Test API `checkins.test.js` (7), Playwright `checkin.spec.js`, Maestro NV 13 |
| 5 | Giao hàng nhanh thêm 50% và **ưu tiên đi trước** | Phụ phí 50% đã có (US-17). Thêm ưu tiên: hàng sắp tới, tồn kho và hàng chờ phân công xếp đơn gửi nhanh lên đầu, có nhãn "Gửi nhanh · ưu tiên"; chạy lại phân công tự động thì đơn nhanh được gán trước | Test API `[US-41] gui nhanh uu tien` |

## 2. Đổi cấu trúc nghiệp vụ — đưa vào kế hoạch

Các góp ý dưới đây thay đổi **mô hình tổ chức** (địa giới, kho, vai trò), không phải sửa một màn hình. Đề xuất
làm thành một đợt "Tái cấu trúc mạng lưới" trước phần giao hàng (Sprint 6), vì giao hàng, hoàn hàng, đối soát đều
dựa trên mạng lưới kho.

| # | Góp ý | Thiết kế đề xuất | Ảnh hưởng |
|---|---|---|---|
| A | Hành chính chỉ còn **tỉnh – xã/phường**, bỏ quận/huyện | Khu vực phục vụ = tỉnh + xã/phường; địa chỉ người gửi/nhận, địa điểm lấy hàng, ước tính phí dùng xã/phường; danh mục xã/phường nạp sẵn | Đổi `ServiceArea`, form địa chỉ ở 3 app, ước tính phí, dữ liệu mẫu, test địa chỉ |
| B | Kho 3 cấp: **mỗi miền một tổng kho (hub)** → **mỗi tỉnh một kho tỉnh** → **mỗi xã một kho cuối**; bỏ tuyến | `Hub.level` = REGION / PROVINCE / WARD, `parentHubId` theo cấp; kho xã phục vụ đúng một xã. Thay `Route` bằng quan hệ kho xã ↔ xã; phân công theo kho xã | Đổi phân công (US-25), ca làm việc (US-23), năng lực (US-24), quy trình kho (US-41) |
| C | Trong kho có các ban: **lấy hàng, xử lý hàng, đầu ra, văn phòng hành chính** (số liệu, quản lý chuyến, phân công nhân viên các ban); mỗi ban một quản lý thay mặt văn phòng | `User.department` + `User.isManager`; quyền theo ban: ban lấy hàng ↔ phân công lấy, ban xử lý ↔ nhập kho / phân loại, ban đầu ra ↔ xuất kho / chuyến, văn phòng ↔ số liệu, phân công nhân viên | Thêm phân quyền theo ban; App Nhân viên đổi trang chủ theo ban |
| D | **Tài xế** (xe tải) chạy tuyến trục: xã ↔ tỉnh ↔ tổng kho miền và ngược lại; chỉ lo chuyến hàng, check-in; **shipper** chỉ hoạt động trong xã đăng ký, đạt chỉ tiêu mới được nhận đơn xã khác. Hai vai trò khác nhau | Vai trò mới `DRIVER` (chuyến hàng: tạo chuyến, check-in đầu/cuối, bàn giao); `SHIPPER` gắn một xã + chỉ tiêu (số đơn giao thành công / tỷ lệ) để mở rộng xã | Thêm collection chuyến hàng (`trips`); quy trình xuất kho (US-41) gắn đơn vào chuyến |
| E | Liên tỉnh chỉ phân loại trong kho, không chạy thẳng tỉnh → tỉnh | Đường đi của đơn tính theo cây kho: xã → tỉnh → tổng kho miền → (tổng kho miền khác) → tỉnh → xã | Đổi cách tính kho đích / chặng tiếp theo trong US-41 |
| F | Ban giao nhận kho tỉnh kiểm tra hư hỏng | Bước "kiểm hàng" khi nhận ở kho tỉnh, ghi tình trạng | Gắn với mục G |
| G | Các công đoạn sau được **tố cáo hư hỏng do công đoạn trước** (nếu khách tích chọn lúc mua hàng) | Ô "Bảo vệ hàng hư hỏng" khi tạo đơn; mỗi lần bàn giao ghi người giao – người nhận; khâu nhận được lập biên bản hư hỏng chỉ ra khâu trước; khiếu nại đi vào US-38 | Mở rộng US-38 (sự cố, khiếu nại) |
| H | **Giao siêu tốc** chỉ trong tỉnh, giao trong ngày, shipper lấy thẳng đi giao | Dịch vụ mới SAME_DAY: chỉ nhận khi nơi gửi và nơi nhận cùng tỉnh; bỏ qua kho, một shipper lấy và giao | Thêm loại dịch vụ, bảng giá, luật tạo đơn, phân công giao |
| I | Tài khoản quản lý theo từng cấp: tổng kho, kho tỉnh, kho xã | Phạm vi dữ liệu theo cây kho (đã có sẵn "hub + bưu cục trực thuộc", mở rộng thành 3 cấp) | Dùng lại `findFamilyIds` cho cây nhiều cấp |
| J | Tính kỹ lại chi phí phục vụ | Phí = phí chặng theo số cấp kho đi qua (nội xã / nội tỉnh / liên tỉnh cùng miền / liên miền) + phụ phí dịch vụ (nhanh 50%, siêu tốc) + khối lượng; bảng giá theo vùng mới | Đổi `pricing.js` (một nguồn duy nhất), bảng giá mẫu, test tính phí |

### Đề xuất kế hoạch

- **Sprint 6 (tái cấu trúc mạng lưới):** A, B, E, I, J — đổi khu vực, kho 3 cấp, đường đi đơn, bảng giá; giữ nguyên
  giao diện các bước đã có. Làm kèm script chuyển dữ liệu mẫu và chạy lại toàn bộ test.
- **Sprint 7:** C, D (ban trong kho, tài xế – chuyến hàng), H (siêu tốc nội tỉnh), cùng phần giao hàng, thu COD,
  giao lại / hoàn hàng (US-31 → US-37) trên mạng lưới mới.
- **Sprint 8:** F, G (kiểm hàng, tố cáo hư hỏng) cùng sự cố – khiếu nại (US-38), đối soát (US-34, US-43), VietQR
  (US-44), thống kê (US-39).
- Dự án kéo dài thêm khoảng một sprint; cần Product Owner duyệt trước khi cập nhật Product Backlog và PERT (quy
  tắc: không cắt, không lùi story đã duyệt).
