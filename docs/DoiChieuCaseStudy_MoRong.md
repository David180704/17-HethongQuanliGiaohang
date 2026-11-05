# Đối chiếu Case study 02 + Case study 14 và chức năng mở rộng — EDMS

Cập nhật 05/11/2026, sau khi Product Owner duyệt phạm vi bổ sung và lập lại PERT
(`PERT_ToanDuAn.docx`). Một dự án EDMS dùng cho cả hai đề cùng chủ đề hệ thống quản lý giao hàng
(một phần thực hành, một phần lý thuyết), nên phải đáp ứng **đồng thời** hai đề và có thêm chức năng
mở rộng. Trạng thái lấy theo Product Backlog, Sprint Backlog và `KiemThuTheoStory.md`.

Ký hiệu: ✅ đã làm, có test · 📅 đã có story trong kế hoạch Sprint 4–7 · ❌ thiếu (chưa có story, hoặc
story chưa xếp Sprint).

## 1. Ma trận truy vết yêu cầu

| # | Yêu cầu | Đề | Đáp ứng bằng | Trạng thái |
|---|---|---|---|---|
| 1 | Shop đăng ký, khai báo thông tin cửa hàng | 02 | US-07 | ✅ |
| 2 | Một shop nhiều địa điểm lấy hàng | 02 | US-15 | ✅ |
| 3 | Tạo yêu cầu giao: người gửi/nhận, hàng, khối lượng, kích thước, giá trị, yêu cầu đặc biệt | 02 | US-18 | ✅ |
| 4 | Thông số hàng: dễ vỡ, trị giá, thu tiền, hàng là xe | 14 | US-17, US-19 | ✅ |
| 5 | Phí theo khu vực, khối lượng, kích thước, dịch vụ, bảng giá tại thời điểm tạo đơn; xem phí trước khi xác nhận | 02, 14 | US-13, US-16, US-17 | ✅ |
| 6 | Thu hộ COD; ba cách trả phí (trả trước, người nhận trả, trừ vào thu hộ) | 02 | US-19 | ✅ |
| 7 | Gửi thường thu tiền khi giao; gửi nhanh chuyển khoản / thanh toán trực tuyến | 14 | US-19; US-44 VietQR: gửi nhanh bắt buộc trả trước chuyển khoản, xác nhận đã nhận tiền | ✅ / 📅 |
| 8 | Nhận mã đơn từ website bán hàng | 14 | US-40: nhập mã đơn của shop khi tạo đơn. Cổng tự nhận đơn từ website (PB#47, mở rộng E3) đã bỏ | 📅 |
| 9 | Nhân viên kiểm hàng, báo giá, nhập đơn tại điểm; chọn phương tiện giao | 14 | US-40 (PB#48): tiếp nhận tại quầy, gợi ý phương tiện | 📅 |
| 10 | Xác nhận đơn → đưa vào quy trình lấy hàng | 02 | US-18 (kho xác nhận, khóa phí) | ✅ |
| 11 | Tuyến/khu vực, ca làm việc, năng lực, thêm nhân viên khi quá tải | 02 | US-11, US-23, US-24, US-25 | ✅ / 📅 |
| 12 | Quản lý điều chỉnh phân công (nghỉ, đổi ca, quá tải, đơn ưu tiên) | 02 | US-25 (thêm tiêu chí, PB#53) | 📅 |
| 13 | Danh sách đơn cần lấy, xác nhận đã lấy | 02 | US-27, US-28 | 📅 |
| 14 | Không lấy được hàng → ghi nguyên nhân | 02 | US-28 (thêm tiêu chí, PB#34) | 📅 |
| 15 | Đi qua kho, điểm trung chuyển, bưu cục; ghi trạng thái nhập/xuất kho, trung chuyển | 02 | Hub/bưu cục (US-14); nhập kho, xuất kho, trung chuyển: US-41 (PB#35, #54, #55) | ✅ / 📅 |
| 16 | Phân loại hàng theo kích cỡ, loại hàng, tuyến xe | 14 | US-41 (PB#50; PB#70 gộp vào) | 📅 |
| 17 | Giao thường gom theo tuyến; giao nhanh là đơn riêng | 14 | US-12, US-25, US-35 (thêm tiêu chí “đơn nhanh giao riêng, ưu tiên”) | ✅ / 📅 |
| 18 | Shop theo dõi tiến trình từng đơn | 02 | US-20 (gồm danh sách đơn lọc theo trạng thái, thời gian — PB#16), US-21, US-22 | 📅 |
| 19 | Khách thấy 4 trạng thái: Chưa nhận / Đã nhận – Chưa giao / Đã nhận – Đang giao / Đã giao | 14 | US-22 | 📅 |
| 20 | Tự check-in khi đi qua điểm trên bản đồ, giúp khách theo dõi | 14 | US-29, US-30 | 📅 |
| 21 | Phân công giao tại khu vực cuối, theo năng lực | 02 | US-35 | 📅 |
| 22 | Giao theo phiếu giao hàng (địa chỉ, phường/xã, số điện thoại) | 14 | US-31: danh sách đơn cần giao + phiếu giao hàng in được có mã QR mã vận đơn (PB#18 đưa lại) | 📅 |
| 23 | Giao thành công + ghi nhận đã thu đủ COD | 02 | US-32, US-33 | 📅 |
| 24 | Giao thất bại → ghi nguyên nhân, giao lại hoặc hoàn | 02 | US-32 (thêm tiêu chí, PB#40), US-36 | 📅 |
| 25 | Đếm số lần giao, vượt giới hạn hoặc bị từ chối → hoàn hàng tới khi shop xác nhận | 02 | US-36, US-37 | 📅 |
| 26 | Sự cố, khiếu nại: nội dung, đơn liên quan, xử lý, kết quả | 02 | US-38 | 📅 |
| 27 | Đối soát định kỳ: thu hộ, phí, điều chỉnh, số tiền trả shop | 02 | US-34; khoản điều chỉnh trong US-43 (PB#76) | 📅 |
| 28 | Shop xem đối soát; ghi nhận giao dịch trả tiền, hoàn tất đối soát | 02 | US-43 (PB#21, #75) | 📅 |
| 29 | Tài khoản ngân hàng nhận tiền COD của shop | 02 | US-42 (PB#12) | 📅 |
| 30 | Danh mục: shop, nhân viên, ca, tuyến/khu vực, kho/điểm trung chuyển, dịch vụ, bảng giá, chính sách | 02 | US-10…14, US-23, US-36 | ✅ / 📅 |
| 31 | Thống kê: đơn theo trạng thái, shop, tuyến, năng suất nhân viên, doanh thu, thu hộ, đối soát | 02 | US-39 | 📅 |
| 32 | Client–server, RESTful API dùng chung; Web cho mọi người dùng; Mobile cho khách hàng | 02 | API + Swagger; Web Khách hàng + App Nhân viên (chạy trên web và Android) + App Khách hàng mobile | ✅ |
| 33 | Tài liệu: actor, use case (sơ đồ, đặc tả, activity, include/extend, package), sơ đồ lớp, ERD, sơ đồ tuần tự, sơ đồ trạng thái | 14 | ERD (`docs/ERD.md`); TL1 (Sprint 4): actor, use case, đặc tả + activity; TL2 (Sprint 5): lớp, tuần tự, trạng thái | ✅ / 📅 |

Kết luận:
- Phần đã làm (Sprint 1–3) đáp ứng đủ các yêu cầu thuộc phạm vi của chúng.
- Lúc đối chiếu (05/11/2026, trước khi bổ sung), kế hoạch Sprint 4–6 cũ **chưa đủ** cho cả hai đề: 14 dòng ❌.
  Nặng nhất là **khâu tại kho** (dòng 15–16). Thiếu khâu này thì không có gì đưa đơn tới trạng thái
  AT_DEST_HUB, mà story phân công giao (US-35) lại cần trạng thái đó; luồng giao hàng bị đứt ở giữa.
- Sau khi bổ sung (mục 2) và lập lại kế hoạch (mục 5): **không còn dòng ❌**. Mọi yêu cầu của hai đề
  đều có story trong Sprint 4–7. Quy trình tại kho (US-41, Sprint 5) được xếp trước phân công giao
  (US-35, Sprint 6).

## 2. Phần bắt buộc cần thêm (bản tinh gọn cho một người làm — chốt 05/11/2026)

Đây là việc bắt buộc để đáp ứng đề, không tính là mở rộng. Mỗi mục được thu gọn để **dùng lại hạ tầng
đã có**: bộ tạo đơn, lịch sử trạng thái nhúng trong đơn, phân quyền theo hub, khung màn hình App Nhân
viên. Không cần hạ tầng mới, không có bước chỉ kiểm được bằng tay.

| Mã | Nội dung | Gộp vào / tạo mới | Story · Sprint | Điểm | Đề |
|---|---|---|---|---|---|
| M1 | **Quy trình tại kho** (đã duyệt): nhân viên kho nhập mã vận đơn → nhận vào kho (AT_HUB, hoặc AT_DEST_HUB nếu là kho đích) → phân loại theo loại hàng và tuyến (SORTED) → xuất kho lên chặng sau (IN_TRANSIT). Loại hàng theo đề 14 (gói nhỏ, bao, thùng, tivi, laptop, CPU, xe…) là danh sách cố định, không làm màn hình quản trị danh mục | Story mới (PB#35, #50, #54, #55) | US-41 · Sprint 5 | 6 | 02, 14 |
| M2 | Tiếp nhận tại quầy: nhân viên kho tìm khách theo số điện thoại (hoặc tạo khách lẻ), dùng lại bộ tạo đơn 4 bước, nhập mã đơn của shop, hệ thống gợi ý phương tiện (xe máy / xe tải theo khối lượng, kích thước, hàng là xe) | Story mới (PB#48) | US-40 · Sprint 4 | 5 | 14 |
| M3 | Không lấy được hàng / giao thất bại kèm nguyên nhân | Thêm tiêu chí (PB#34, #40) | US-28 (3 → 4) · Sprint 5; US-32 (3 → 5) · Sprint 6 | +3 | 02 |
| M4 | Quản lý điều chỉnh phân công tay (nghỉ, đổi ca, quá tải, đơn ưu tiên), bắt buộc ghi lý do | Thêm tiêu chí (PB#53) | US-25 (5 → 7) · Sprint 4 | +2 | 02 |
| M5 | Danh sách đơn của khách, lọc theo trạng thái và thời gian (API đã có) | Thêm tiêu chí (PB#16) | US-20 (2 → 4) · Sprint 4 | +2 | 02 |
| M6 | Khách khai báo tài khoản ngân hàng nhận COD | Story mới (PB#12) | US-42 · Sprint 5 | 2 | 02 |
| M7 | Shop xem kỳ đối soát; khoản điều chỉnh; ghi nhận đã chi trả | Story mới (PB#21, #75, #76) | US-43 · Sprint 7 | 5 | 02 |
| M8 + E4 | **Thanh toán phí bằng VietQR** (đã duyệt): gửi nhanh bắt buộc trả trước chuyển khoản; QR động sinh ngay trong hệ thống; nhân viên xác nhận đã nhận tiền | Story mới (PB#83) | US-44 · Sprint 7 | 4 | 14 |
| M9 | Phiếu giao hàng (in được, xem trong app tài xế) có **mã QR chứa mã vận đơn** | Thêm tiêu chí (PB#18 đưa lại) | US-31 (3 → 6) · Sprint 6 | +3 | 14 |
| M10 | Luật “đơn nhanh giao riêng, ưu tiên” khi phân công giao | Thêm tiêu chí | US-35 (5 → 6) · Sprint 6 | +1 | 14 |
| M11 | Bộ tài liệu UML (actor, use case, đặc tả + activity, lớp, tuần tự, trạng thái) | Việc tài liệu (không tính điểm story) | TL1 · Sprint 4; TL2 · Sprint 5 | — | 14 |

Tổng **33 điểm** việc bắt buộc, gồm cả mở rộng E4 đã duyệt: Product Backlog từ 39 story / 137 điểm
thành **44 story / 170 điểm**.

**Đánh giá khả năng một người làm**: làm được.
- Phần rủi ro nhất là M1 (thêm chuyển trạng thái và màn hình kho) và M2 (đưa bộ tạo đơn sang App Nhân viên).
- Cả hai dựa trên mã Sprint 3 đã có test, nên kiểm thử được bằng API test và Playwright như các story trước.
- Module check-in GPS (US-29, US-30) là bắt buộc của đề 14, nên vẫn giữ. Kiểm thử bằng tọa độ giả lập:
  gửi lat/lng qua API, hoặc `adb emu geo fix` trên máy ảo. Không cần đi thật.

**Cách kiểm thử khi một người đóng nhiều vai** (người làm dự án có toàn quyền mọi tài khoản):
- Mỗi vai một tài khoản test riêng: khách / shop, nhân viên kho (kho1–3 ở các hub khác nhau), tài xế
  (taixe1–5), quản trị (admin).
- Mỗi vai mở trên một trình duyệt hoặc thiết bị riêng. Kiểm thử tự động bằng Playwright nhiều context
  (như kịch bản đã có: khách tạo đơn trên Web → kho duyệt trên App Nhân viên) và Maestro trên máy ảo.
- Một đơn đi trọn vòng đời bằng cách lần lượt đổi vai: khách tạo → kho duyệt → tài xế lấy hàng → kho
  nhập / phân loại / xuất → kho đích nhận → tài xế giao → thu COD → đối soát.
- Định vị và check-in dùng tọa độ giả lập: API nhận tọa độ; máy ảo phát lại một tuyến GPX hoặc dùng
  `adb emu geo fix`. Đủ để chứng minh check-in tự động mà không cần giao hàng thật.
- Không có máy chủ công khai: mọi kiểm thử chạy trên máy dev, mạng LAN hoặc máy ảo.

## 3. Chức năng mở rộng ĐÃ LÀM (vượt yêu cầu của cả hai đề)

1. **Ba ứng dụng trên một API**: Web Khách hàng; App Nhân viên (Expo) chạy được cả trên Android và
   trình duyệt, giao diện đổi theo vai trò; App Khách hàng mobile.
2. **Khách vãng lai dùng được trước khi có tài khoản**: xem dịch vụ, vùng phục vụ, bảng giá, ước tính
   phí. Bấm “Gửi hàng” thì bản nháp được giữ 24 giờ qua bước đăng ký và điền sẵn vào màn hình tạo đơn.
3. **Bảo mật**:
   - JWT có Access/Refresh Token; đăng xuất đưa token vào danh sách chặn trên Redis; đăng xuất mọi thiết bị.
   - Khóa 15 phút sau 5 lần sai mật khẩu; chặn tài khoản dùng sai ứng dụng.
   - Phân quyền theo cây kế thừa vai trò (CUSTOMER ⊃ GUEST); chặn open redirect.
4. **Cache hai tầng 30 giây**: Redis phía server và bộ đệm phía app, kèm tự làm mới. Khi admin sửa
   danh mục, EventBus xóa cache liên quan.
5. **Tìm kiếm tiếng Việt không dấu**: gõ “hoan kiem” vẫn ra Hoàn Kiếm. Địa chỉ gõ không dấu được tự
   khớp về tên chuẩn của vùng phục vụ.
6. **Mạng lưới hub → bưu cục trực thuộc**: mỗi điểm tự gắn khu vực phục vụ. Nhân viên hub thấy cả đơn
   của các bưu cục trực thuộc.
7. **Bảng giá có hiệu lực theo thời gian**:
   - Chặn bậc chồng lấn hoặc hở; chặn trùng khoảng hiệu lực.
   - Bảng giá đã dùng cho đơn thì không sửa, không xóa được.
   - Phí khóa vào đơn khi xác nhận; đơn lưu bảng giá đã dùng để đối chiếu.
8. **Tạo đơn an toàn khi đồng thời**:
   - Transaction gói 3 collection (counter, orders, orderDrafts); mã vận đơn sinh từ counter.
   - Đã kiểm: 10 đơn tạo cùng lúc ra 10 mã liên tiếp; lỗi giữa chừng thì toàn bộ được hoàn lại.
9. **Kiến trúc SOLID và 12 mẫu thiết kế**: Factory, Template Method, Decorator, Observer, Strategy,
   Repository, Adapter, Unit of Work (transaction tạo đơn), DI container… (tài liệu `docs/KienTrucAPI.md`).
10. **Dữ liệu**:
    - MongoDB Atlas (cloud), CSDL local trong Docker làm phương án dự phòng.
    - Seed 200 đơn trải đủ 18 trạng thái.
    - Script mongosh tạo cấu trúc CSDL, có `$jsonSchema` lấy từ chính model.
11. **Kiểm thử tự động nhiều tầng**:
    - 153 test API, gắn nhãn theo từng story.
    - Playwright cho 3 app, gồm kịch bản liên ứng dụng: khách tạo đơn trên Web → kho duyệt trên App
      Nhân viên.
    - 17 flow Maestro trên máy ảo Android; kiểm thử liên thiết bị (máy ảo ↔ web) chạy song song.
    - Báo cáo kiểm thử theo story sinh tự động.
12. **DevOps**: CI trên GitHub Actions (lint → seed → test → build Docker); Swagger cho mọi API; script
    một lệnh dựng toàn bộ demo (`chay-demo.ps1`).

Mở rộng đã có trong kế hoạch Sprint 4–7:
- Hàng đợi sự kiện BullMQ có retry và dead-letter queue (US-21).
- Tra cứu công khai có giới hạn 20 request/phút và che số điện thoại (US-22).
- Năng lực xử lý 3 cấp (US-24).
- Phân công tự động có transaction chống vượt năng lực (US-25).
- Check-in GPS chặn trùng 30 phút, xếp hàng đợi khi mất mạng (US-30).
- Dashboard bằng aggregation (US-39).

## 4. Chức năng mở rộng đề xuất — quyết định 05/11/2026

| Mã | Chức năng | Quyết định |
|---|---|---|
| E4 | **Thanh toán phí bằng VietQR**: QR động đúng số tiền và nội dung chuyển khoản (theo chuẩn VietQR/EMVCo, sinh trong hệ thống, không phụ thuộc dịch vụ ngoài); xác nhận đã nhận tiền | ✅ **Duyệt**, làm cùng M8 |
| E1 | Nhãn vận đơn có QR + quét bằng camera | Bỏ phần quét camera (khó kiểm thử trên quy trình mô phỏng). Giữ **QR chứa mã vận đơn in trên phiếu giao hàng** (thuộc M9, đề 14 bắt buộc có phiếu) |
| E2 | Bản đồ hành trình (OpenStreetMap) | Bỏ: bản đồ chỉ có ý nghĩa khi giao hàng thật, định vị thật và có máy chủ triển khai công khai cho điện thoại ngoài đường gọi tới, mà dự án không có hạ tầng đó. Khách vẫn theo dõi được qua các mốc check-in dạng danh sách (US-22, US-30) |
| E3, E5, E6, E7, E8, E9 | Cổng website bán hàng, thông báo, dán địa chỉ, tối ưu thứ tự giao, ảnh bằng chứng, tạo đơn từ Excel | Bỏ |

Mở rộng dùng để trình bày với giảng viên: các mục ở phần 3 (đã làm và đã có kế hoạch), cộng E4.

## 5. Ảnh hưởng tới lịch PERT (đã lập lại 05/11/2026)

`PERT_ToanDuAn.docx` lập lại với 7 Sprint, cùng quy tắc: mỗi Sprint = PT + task + KT + DP, trễ thì
dùng dự phòng → kéo dài Sprint → dời Sprint sau, **không cắt story**.

| Sprint | Thời gian | Mục tiêu | Story (thứ tự làm) |
|---|---|---|---|
| 3 | 29/10 – 05/11/2026 (thực tế) | Tạo đơn và tính phí | US-14 → US-19, xong 6/6 |
| 4 | 06/11 – 01/12/2026 (18 ngày) | Hành trình đơn, tiếp nhận tại quầy, phân công lấy hàng | TL1, US-20, 21, 22, 40, 23, 24, 25, 27 (US-26 đã xong sớm) |
| 5 | 02/12 – 18/12/2026 (13 ngày) | Lấy hàng, quy trình tại kho, check-in GPS | US-28, 41, 29, 30, 42, TL2 |
| 6 | 21/12/2026 – 11/01/2027 (15 ngày) | Giao hàng, thu COD, giao lại, hoàn hàng | US-35, 31, 32, 33, 36, 37 |
| 7 | 12/01 – 02/02/2027 (16 ngày) | Thanh toán VietQR, đối soát, sự cố, thống kê | US-44, 34, 43, 38, 39 |

- Dự án kết thúc **02/02/2027** (kế hoạch ngày 29/10/2026: 19/01/2027), trước kỳ nghỉ Tết Nguyên Đán
  (giả định 04–10/02/2027). Thêm 33 điểm và Sprint 7 mà chỉ muộn hơn hai tuần, nhờ Sprint 3 xong sớm
  9 ngày làm việc (đóng 05/11, kế hoạch 18/11/2026).
- Thứ tự story sắp theo luồng nghiệp vụ: lấy hàng → quy trình tại kho → phân công giao → giao hàng →
  thu COD → đối soát. Kế hoạch cũ xếp US-31 (danh sách đơn cần giao) trước US-35 (phân công giao) —
  sai phụ thuộc, nay US-35 làm trước; US-41 (kho) làm trước US-35 vì phân công giao cần AT_DEST_HUB.
- US-40 vào Sprint 4 vì dùng ngay bộ tạo đơn của Sprint 3; US-44 (VietQR) chỉ phụ thuộc US-19 nên
  làm đầu Sprint 7.
- Nếu trễ quá phần dự phòng: US-21 (hàng đợi BullMQ, 5 điểm) là mở rộng kỹ thuật, không đề nào bắt
  buộc, là ứng viên đầu tiên để làm đơn giản lại. Việc này cần Product Owner quyết định.
