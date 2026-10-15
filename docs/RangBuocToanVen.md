# Ràng buộc toàn vẹn dữ liệu — EDMS (Sprint 1-2)

Tài liệu này liệt kê **mọi con số và điều kiện cụ thể** đã cài vào hệ thống,
phân loại đúng theo lý thuyết CSDL (ràng buộc miền giá trị, ràng buộc khóa,
ràng buộc tham chiếu, ràng buộc kiểm tra, ràng buộc liên trường/liên bản ghi)
để trả lời khi giảng viên hỏi "ràng buộc toàn vẹn nào đã khai báo".

## 0. Điểm lý thuyết quan trọng nhất cần nói trước

> **MongoDB không có ràng buộc khóa ngoại (FOREIGN KEY) tự động như SQL.**

Khi một field khai báo `ref: "User"`, đó **chỉ là quy ước cho Mongoose biết
cách `populate()`** (lấy dữ liệu đầy đủ của bản ghi được trỏ tới), **không
hề ngăn được** việc lưu một `ObjectId` trỏ tới bản ghi không tồn tại hoặc đã
bị xóa. Đây là khác biệt cốt lõi giữa NoSQL document-oriented và RDBMS.

→ Tính toàn vẹn tham chiếu ở đây được đảm bảo bằng **code tầng ứng dụng**,
không phải do CSDL tự ép buộc:
1. Service tự kiểm tra bản ghi liên quan tồn tại trước khi lưu (ví dụ sẽ kiểm
   tra `customerId` tồn tại trước khi tạo đơn ở Sprint 3).
2. Dùng **transaction** của MongoDB để gộp nhiều thao tác ghi liên quan
   (nhiều collection) thành một khối "tất cả cùng thành công hoặc cùng hủy".

## 1. Ràng buộc miền giá trị (Domain constraint — enum)

Khai báo tại `code/apps/api/src/constants/enums.js`, áp vào từng field kiểu
`enum` trong model. Mỗi field chỉ nhận đúng các giá trị liệt kê, sai thì
Mongoose tự chặn, không cần code tay kiểm tra lại.

| Field | Miền giá trị cho phép |
|---|---|
| `User.role` | GUEST · CUSTOMER · SHIPPER · HUB_STAFF · ADMIN |
| `User.status` | PENDING · ACTIVE · LOCKED |
| `User.customerType` | INDIVIDUAL · BUSINESS |
| `Hub.type` | HUB · POST_OFFICE |
| `ServiceArea.region` | BAC · TRUNG · NAM |
| `ServiceType.code` | STANDARD · EXPRESS |
| `PriceTable.zone`, `Order.zone` | INNER_DISTRICT · INNER_PROVINCE · INTER_PROVINCE · INTER_REGION |
| `Order.cod.feePayer` | SHOP_PREPAID · RECIPIENT_PAID · DEDUCT_FROM_COD |
| `Order.cod.feePaymentMethod` | QR · CASH |
| `Order.cod.method` | CASH · TRANSFER |
| `Order.status` | 18 giá trị (xem vòng đời đơn trong CLAUDE.md) |
| `Assignment.type` | PICKUP · DELIVERY · RETURN |
| `Assignment.method` | AUTO · MANUAL |

## 2. Ràng buộc khóa / duy nhất (Key constraint — unique index)

| Collection | Field(s) | Loại khóa |
|---|---|---|
| `users` | `email` | Khóa duy nhất đơn |
| `users` | `phone` | Khóa duy nhất đơn |
| `roles` | `code` | Khóa duy nhất đơn |
| `hubs` | `code` | Khóa duy nhất đơn |
| `routes` | `code` | Khóa duy nhất đơn |
| `serviceTypes` | `code` | Khóa duy nhất đơn |
| `orders` | `trackingCode` | Khóa duy nhất đơn |
| `orderDrafts` | `draftToken` | Khóa duy nhất đơn |
| `serviceAreas` | `(province, district)` | **Khóa duy nhất kép (compound)** — đây chính là cách hiện thực quy tắc nghiệp vụ "một quận/huyện chỉ thuộc một tuyến": vì mỗi cặp (tỉnh, huyện) chỉ được phép xuất hiện một lần, mà mỗi bản ghi chỉ gắn một `routeId`, nên về mặt toán học một huyện không thể vừa thuộc tuyến A vừa thuộc tuyến B |

## 3. Ràng buộc kiểm tra (Check constraint) — các con số cụ thể

Đây là phần bạn hỏi trực tiếp — mọi **con số** đang tồn tại thật trong hệ thống:

| # | Con số | Ý nghĩa | Khai báo ở đâu |
|---|---|---|---|
| 1 | **15 phút** | Access Token hết hạn sau 15 phút | `config/env.js` (`JWT_ACCESS_EXPIRES_IN`) |
| 2 | **7 ngày** | Refresh Token hết hạn sau 7 ngày | `config/env.js` (`JWT_REFRESH_EXPIRES_IN`) |
| 3 | **5 lần** | Số lần đăng nhập sai liên tiếp tối đa trước khi khóa | `core/loginThrottle.js` (`MAX_ATTEMPTS`) |
| 4 | **15 phút (900 giây)** | Thời gian khóa tạm sau khi vượt ngưỡng 5 lần sai | `core/loginThrottle.js` (`LOCK_SECONDS`) |
| 5 | **10** | Số vòng băm bcrypt (cost factor) cho mật khẩu | `auth.service.js`, `users.schema.js` |
| 6 | **0 — 20.000.000đ** | Khoảng giá trị hợp lệ của `cod.amount` (min/max) | `models/Order.js` |
| 7 | **300 giây (5 phút)** | Thời gian cache kết quả duyệt cây phân quyền trên Redis | `middleware/rbac.js` (`CACHE_TTL_SECONDS`) |
| 8 | **86.400 giây (24 giờ)** | `orderDrafts` tự xóa sau 24h không dùng tới (TTL index) | `models/OrderDraft.js` |
| 9 | **~20 phần tử** | Ngưỡng quyết định nhúng hay tham chiếu dữ liệu con | Quy ước thiết kế (CLAUDE.md mục 4) |

## 4. Ràng buộc bắt buộc nhập (NOT NULL / required)

Mỗi model đều khai báo `required: true` cho field không được phép thiếu —
ví dụ `User` bắt buộc phải có `email, phone, passwordHash, fullName, role`;
`Order` (sẽ có ở Sprint 3) bắt buộc phải có `trackingCode, customerId,
receiver, item, serviceTypeId`... Mongoose chặn lưu nếu thiếu, trả lỗi
`VALIDATION_ERROR` tự động trước khi chạm tới database thật.

## 5. Ràng buộc liên trường / liên bản ghi (không khai báo tĩnh được)

Đây là nhóm ràng buộc **quan trọng nhất về mặt lý thuyết** để trả lời "vì
sao không viết hết trong schema mà phải viết trong code service" — vì chúng
phụ thuộc **quan hệ giữa nhiều trường hoặc nhiều bản ghi cùng lúc**, một
khai báo schema tĩnh (kiểu `required`/`enum`/`unique`) không diễn đạt được:

| Ràng buộc | Vì sao không khai báo tĩnh được |
|---|---|
| Nếu `feePayer = DEDUCT_FROM_COD` thì `cod.amount` phải ≥ `fee.total` | Phụ thuộc quan hệ giữa 2 trường khác nhau tại thời điểm ghi — phải so sánh bằng code, Mongoose không có "check constraint" kiểu SQL |
| Các bậc khối lượng (`weightTiers`) trong cùng một bảng giá không được chồng lấn và không được hở khoảng trống | Phải so sánh TOÀN BỘ mảng với nhau (bậc này kết thúc ở đâu bậc kia phải bắt đầu đúng ở đó) |
| Hai bảng giá cùng `serviceTypeId` + cùng `zone` không được trùng khoảng hiệu lực (`effectiveFrom`-`effectiveTo`) | Phải so sánh với CÁC BẢN GHI KHÁC đã tồn tại trong collection, không chỉ bản ghi đang tạo |
| Một quận/huyện chỉ thuộc một tuyến | Thực ra làm được tĩnh — xem lại mục 2 (unique index kép) |

**Chốt lại một câu dễ nhớ**: SQL có "CHECK constraint" khai báo ngay trong
câu lệnh tạo bảng (DDL); MongoDB/Mongoose **không có khái niệm tương đương**
— mọi ràng buộc phức tạp hơn domain/unique/required đều phải tự viết bằng
code ở tầng service, chạy TRƯỚC khi gọi lệnh ghi xuống database.

## 6. Toàn vẹn giao dịch (Transaction integrity)

MongoDB chỉ hỗ trợ transaction khi chạy ở chế độ **replica set** (lý do
`docker-compose.yml` cấu hình Mongo chạy `--replSet rs0` dù chỉ có 1 node).
Transaction dùng để đảm bảo: hoặc **toàn bộ** các lệnh ghi trong một khối
đều thành công, hoặc **không lệnh nào** được áp dụng — tránh tình trạng ghi
nửa chừng rồi lỗi giữa đường làm dữ liệu sai lệch giữa các collection liên
quan nhau. Sprint 1 đã có bài test xác nhận transaction hoạt động đúng
(`tests/transaction.test.js`); nghiệp vụ thật sự cần transaction (tạo đơn,
ghi COD) sẽ làm ở Sprint 3 trở đi.
