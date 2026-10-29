# Bài giới thiệu EDMS — kịch bản thuyết trình

Dùng để đọc/diễn thuyết trực tiếp. Mỗi mục lớn ứng với một phần trình bày.

---

## 1. Đặt vấn đề

Thương mại điện tử ở Việt Nam bùng nổ kéo theo nhu cầu giao nhận hàng hóa
tăng mạnh. Vận hành thủ công gây ba vấn đề chính: **chậm trễ** trong khâu
phân công giao nhận, **sai sót đối soát** tiền thu hộ (COD) giữa công ty và
khách hàng, và **khó truy vết** hành trình đơn hàng khi khách hỏi.

**EDMS (Express Delivery Management System)** giải quyết bài toán này cho
một công ty chuyển phát nhanh giả định ("Công ty Chuyển phát nhanh Saigon"),
mô phỏng toàn diện quy trình Scrum cho một đồ án học thuật.

## 2. Mục tiêu và phạm vi

Hệ thống quản lý giao hàng tập trung, kiến trúc client-server đa nền tảng
(Web cho khách hàng/admin, Mobile cho shipper), phục vụ **5 vai trò**:

| Vai trò        | Vai trò chính                                                        |
| -------------- | -------------------------------------------------------------------- |
| Khách vãng lai | Tra cứu đơn, ước tính phí, xem bảng giá — không cần đăng nhập        |
| Khách hàng     | Toàn bộ quyền trên + tạo đơn, theo dõi đơn                           |
| Shipper        | Lấy/giao hàng, thu COD — chỉ trên đơn được giao cho mình             |
| Nhân viên hub  | Duyệt đơn, phân công, nhập/xuất kho — chỉ trong phạm vi hub của mình |
| Admin          | Danh mục, bảng giá, phân quyền, đối soát                             |

**Đã hoàn thành (Sprint 1–2)**: nền tảng kỹ thuật, xác thực/phân quyền đầy
đủ, quản trị danh mục (người dùng, tuyến, khu vực, loại dịch vụ, bảng giá).
**Chưa làm (Sprint 3–6)**: tạo đơn, tính phí, giao nhận, check-in GPS, đối
soát, hoàn hàng, sự cố, thống kê — đây đều là nghiệp vụ lõi, đã có lịch theo
PERT toàn dự án (PERT_ToanDuAn.docx) trong Sprint Backlog.

## 3. Quy trình làm việc

Phát triển theo Scrum, **một người** đảm nhiệm toàn bộ vai trò (Product
Owner, Scrum Master, Developer, Tester). 5 Sprint, mỗi Sprint có Sprint
Planning riêng (mục tiêu, backlog, phân rã Task, rủi ro/biện pháp) và Sprint
Review/Retrospective (cập nhật kế hoạch so với thực tế). Mỗi Sprint phát
triển trên **một nhánh Git riêng** (`sprint-1`, `sprint-2`...), commit nhỏ
gắn mã User Story (`feat(US-06): ...`), merge tuần tự vào `main`.

## 4. Kiến trúc và công nghệ

```
Client (Web/Mobile)
      │  HTTP + JSON, Bearer Token
      ▼
Express API (Node.js, ESM)
      │
      ├── Middleware: xác thực (JWT) → phân quyền (RBAC cây) → validate
      ├── Service: xử lý nghiệp vụ
      └── Model (Mongoose) ──────────────► MongoDB (12 collection, replica set)
                             │
                             └────────────► Redis (cache tạm: khóa đăng nhập,
                                             cây quyền, token thu hồi)
```

Node.js + Express · MongoDB 7 (replica set, bắt buộc để dùng transaction) +
Mongoose 8 · Redis 7 · JWT (Access 15 phút / Refresh 7 ngày) · Swagger tự
sinh tài liệu · `node:test` + Supertest kiểm thử · GitHub Actions CI.

## 5. Một vòng hoạt động — đi chi tiết một yêu cầu từ đầu đến cuối

Đây là phần quan trọng nhất để chứng minh hiểu "ngóc ngách" hệ thống. Lấy
ví dụ: **một người dùng đăng nhập, rồi gọi một API cần quyền quản trị.**

### Bước 1 — Đăng nhập (`POST /auth/login`)

1. Client gửi `{emailOrPhone, password}`.
2. **Guard ngược** chạy trước tiên: nếu request đã mang theo Access Token
   hợp lệ (nghĩa là đã đăng nhập rồi), API từ chối ngay (403) — không cho
   đăng nhập chồng.
3. Service kiểm tra **Redis trước** xem định danh này có đang bị khóa tạm
   không (`login:lock:<email>`) — nếu có, trả 423 ngay, **không chạm tới
   MongoDB, không chạy bcrypt** (tối ưu: từ chối sớm, đỡ tốn tài nguyên).
4. Nếu chưa khóa: tìm user trong MongoDB theo email/phone.
5. So mật khẩu gửi lên với `passwordHash` đã băm sẵn bằng bcrypt (so sánh
   một chiều — không bao giờ giải mã ngược lại mật khẩu gốc).
6. **Sai** → tăng bộ đếm sai trên Redis; chạm mốc 5 lần → khóa 15 phút
   (423) ngay tại lần thứ 5, không đợi lần 6.
   **Đúng** → xóa bộ đếm sai (reset), phát ra **Access Token** (15 phút,
   chứa `userId` + `role`) và **Refresh Token** (7 ngày, chứa thêm mã định
   danh `jti` + số phiên bản `ver` để phục vụ thu hồi sau này).
7. Trả về client theo khuôn chuẩn `{success:true, data:{accessToken,
refreshToken, user:{...}}}`.

### Bước 2 — Gọi một API cần quyền (`GET /users`, ví dụ)

1. Client đính token vào header `Authorization: Bearer <token>`.
2. Middleware `requireAuth` giải mã chữ ký JWT bằng khóa bí mật server giữ
   — chữ ký sai hoặc hết hạn (quá 15 phút) → 401 ngay, dừng tại đây, **chưa
   hề chạm database**.
3. Middleware `requirePermission("users:manage")` chạy tiếp: lấy `role` từ
   token, hỏi Redis xem đã có cache quyền của role này chưa (cache sống 300
   giây).
   - **Có cache** → dùng luôn, không chạm MongoDB.
   - **Chưa có** → đọc collection `roles`, **duyệt theo cây `inheritsFrom`**
     (ví dụ CUSTOMER sẽ gộp cả quyền của GUEST — không so khớp phẳng), rồi
     lưu kết quả vào Redis cho lần sau.
4. Không đủ quyền → 403. Đủ quyền (hoặc role có quyền `"*"` như ADMIN) →
   đi tiếp vào service.
5. Service gọi Mongoose đọc collection `users` (có phân trang, tìm kiếm,
   **tự loại bỏ field `passwordHash`** trước khi trả về).
6. Trả kết quả theo khuôn chuẩn `{success:true, data:[...], meta:{page,
limit,total}}`.

### Vì sao kể câu chuyện này chứng minh được nhiều nhất

Một vòng duy nhất này đã chạm đủ **5 lớp** của kiến trúc (middleware xác
thực, middleware phân quyền, service, MongoDB, Redis) và **3 cơ chế bảo mật
cụ thể** (khóa sau 5 lần sai, JWT ngắn hạn, cây phân quyền có kế thừa) —
đây chính là nội dung nên kể khi được hỏi "hệ thống hoạt động như thế nào".

## 6. Phụ lục — Bằng chứng chi tiết Sprint 1 (US-01 → US-04)

Đủ cả **tác dụng**, **vị trí trong dự án**, và **cách chứng minh khi demo**
cho từng Task T1–T8:

| Task                                    | Tác dụng                                                                | Vị trí                                                          | Cách chứng minh khi demo                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **T1** Khởi tạo repo, quy ước mã nguồn  | Tạo khung dự án, luật viết code thống nhất                              | `.gitignore`, `package.json`, `eslint.config.js`, `.prettierrc` | Mở GitHub xem lịch sử commit đặt tên `feat(US-xx)`; chạy `npm run lint` live cho thấy sạch                |
| **T2** Docker Compose Mongo+Redis       | Dựng môi trường 1 lệnh, Mongo chạy replica set để dùng được transaction | `code/docker-compose.yml`                                       | Chạy `docker compose ps` live → 2 container "healthy"; mở MongoDB Compass gõ `rs.status()` cho thấy `rs0` |
| **T3** Sơ đồ ERD                        | Thiết kế cấu trúc dữ liệu trước khi code                                | `docs/ERD.md`                                                   | Mở file này trên GitHub (web) — Mermaid tự vẽ thành hình                                                  |
| **T4** Mongoose model + chỉ mục + seed  | Định nghĩa 12 collection thật, tạo dữ liệu demo                         | `src/models/*.js`, `src/seed/*.js`                              | Chạy `npm run seed` live → log hiện "200 đơn, 19 user..."; mở Compass đếm số bản ghi thật                 |
| **T5** Đăng ký, đăng nhập, phát token   | Tạo tài khoản, đăng nhập, nhận token                                    | `modules/auth/auth.service.js`, `core/jwt.js`                   | Swagger gọi `POST /auth/login` → thấy `accessToken`/`refreshToken` trong response                         |
| **T6** Middleware xác thực + phân quyền | Chặn request không hợp lệ/không đủ quyền                                | `middleware/auth.js`, `middleware/rbac.js`                      | Gọi cùng 1 API 3 lần: không token (401) → token CUSTOMER (403) → token ADMIN (200)                        |
| **T7** Response chuẩn, mã lỗi, Swagger  | Mọi API trả theo 1 khuôn; tài liệu tự sinh                              | `core/response.js`, `core/errors.js`, `docs/swagger.js`         | Mở `/api-docs`; gọi 1 API lỗi cho thấy luôn có dạng `{success:false,error:{code,message}}`                |
| **T8** Test case, Postman, đẩy Git      | Đảm bảo code đúng tự động                                               | `tests/*.test.js`, `EDMS.postman_collection.json`               | Chạy `npm test` live → `tests 33/pass 33`; mở Postman chạy thử 1 request                                  |

---

**Một câu chốt nếu hết giờ chỉ nói được một câu**: _"Hệ thống đã xây xong
nền tảng kỹ thuật và toàn bộ lớp bảo mật — xác thực, phân quyền, khóa tài
khoản — đều là code thật chạy được, có 33 kiểm thử tự động xác nhận, không
phải mô tả suông."_
