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

Hệ thống quản lý giao hàng tập trung, kiến trúc client-server: một RESTful API
dùng chung cho ba ứng dụng — **Web Khách hàng**, **App Nhân viên** (Expo, chạy trên
Android và trình duyệt, giao diện đổi theo vai trò quản trị / kho / tài xế) và
**App Khách hàng mobile** — phục vụ **5 vai trò**:

| Vai trò        | Vai trò chính                                                        |
| -------------- | -------------------------------------------------------------------- |
| Khách vãng lai | Tra cứu đơn, ước tính phí, xem bảng giá — không cần đăng nhập        |
| Khách hàng     | Quyền trên + địa điểm lấy hàng, tạo đơn, theo dõi đơn                |
| Shipper        | Lấy/giao hàng, thu COD — chỉ trên đơn được giao cho mình             |
| Nhân viên hub  | Duyệt đơn, tiếp nhận tại quầy, phân công, nhập/xuất kho — trong hub  |
| Admin          | Danh mục, bảng giá, phân quyền, đối soát                             |

**Một dự án cho hai đề**: EDMS đáp ứng đồng thời Case study 02 (phần thực
hành) và Case study 14 (phần lý thuyết — coi nhân viên tiếp nhận tại quầy là
luồng chính và yêu cầu bộ tài liệu UML). Ma trận truy vết 33 yêu cầu của hai đề
và danh sách chức năng mở rộng: `docs/DoiChieuCaseStudy_MoRong.md`. Mở rộng được
duyệt thêm: **thanh toán phí bằng mã VietQR**.

**Đã hoàn thành (Sprint 1–3)**: nền tảng kỹ thuật, xác thực/phân quyền đầy
đủ, quản trị danh mục (người dùng, tuyến, khu vực, loại dịch vụ, bảng giá, hub
và bưu cục), địa điểm lấy hàng, ước tính phí, tạo đơn có thu hộ, kho duyệt đơn
và khóa phí. **Còn lại (Sprint 4–7, đến 02/02/2027)**: hành trình đơn, tiếp
nhận tại quầy, phân công, lấy hàng, quy trình tại kho, check-in GPS, giao hàng,
thu COD, hoàn hàng, VietQR, đối soát, sự cố, thống kê — đã có lịch theo PERT
toàn dự án (PERT_ToanDuAn.docx) trong Sprint Backlog.

## 3. Quy trình làm việc

Phát triển theo Scrum, **một người** đảm nhiệm toàn bộ vai trò (Product
Owner, Scrum Master, Developer, Tester). 7 Sprint (kế hoạch lập lại ngày
05/11/2026 sau khi đối chiếu Case study 14), mỗi Sprint có Sprint Planning
riêng (mục tiêu, backlog, phân rã Task, rủi ro/biện pháp) và Sprint
Review/Retrospective (cập nhật kế hoạch so với thực tế). Mỗi Sprint phát
triển trên **một nhánh Git riêng** (`sprint-1`, `sprint-2`...), commit nhỏ
gắn mã User Story (`feat(US-06): ...`), merge tuần tự vào `main`. Mỗi task
xong phải có test; mỗi story xong có thêm một test luồng nghiệp vụ API và một
kịch bản giao diện Playwright cho đúng luồng đó.

## 4. Kiến trúc và công nghệ

```
Web Khách hàng · App Nhân viên · App Khách hàng mobile
      │  HTTP + JSON, Bearer Token
      ▼
Express API (Node.js, ESM)
      │
      ├── Middleware: xác thực (JWT) → phân quyền (RBAC cây) → validate
      ├── Controller → Service: nghiệp vụ, ràng buộc, transaction
      └── Repository (cache 30 giây) → Model (Mongoose) ──► MongoDB (12 collection, replica set)
                             │
                             └────────────► Redis (khóa đăng nhập, cây quyền,
                                             token thu hồi, cache danh mục)
```

Node.js + Express · MongoDB 7 (replica set, bắt buộc để dùng transaction) +
Mongoose 8 · Redis 7 · JWT (Access 15 phút / Refresh 7 ngày) · Swagger tự
sinh tài liệu · React + Vite + Tailwind (Web) · Expo React Native (hai app di
động) · `node:test` + Supertest kiểm thử API, Playwright và Maestro kiểm thử
giao diện · GitHub Actions CI. Chi tiết các lớp, SOLID và mẫu thiết kế:
`docs/KienTrucAPI.md`.

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

## 6. Một vòng nghiệp vụ — từ ước tính phí đến kho duyệt đơn (Sprint 3)

Luồng nghiệp vụ lõi đầu tiên đã chạy trọn vòng, qua ba ứng dụng và ba vai trò:

1. **Khách vãng lai ước tính phí** (`POST /orders/estimate-fee`, không cần
   đăng nhập): nhập nơi gửi, nơi nhận, khối lượng, kích thước. Hệ thống tìm khu
   vực phục vụ hai đầu (gõ không dấu vẫn khớp), xác định vùng (nội quận, nội
   tỉnh, liên tỉnh, liên vùng), chọn bảng giá đang hiệu lực của dịch vụ rồi tính
   bằng **một hàm thuần duy nhất** `pricing.js`: khối lượng quy đổi
   `dài × rộng × cao / 5000`, bậc khối lượng, phụ phí dịch vụ, phụ phí đặc biệt
   (dễ vỡ, giá trị cao, hàng là xe).
2. **Bấm "Gửi hàng"**: dữ liệu vừa nhập lưu thành **bản nháp** (`/orderDrafts`,
   token ngẫu nhiên, MongoDB tự xóa sau 24 giờ). Khách đăng ký hoặc đăng nhập
   xong thì màn hình tạo đơn được điền sẵn.
3. **Tạo đơn 4 bước** (nơi gửi → người nhận → hàng hóa và dịch vụ → thu hộ và
   xác nhận phí). Bước cuối tách từng khoản phí; luật thu hộ chặn ngay trên
   form: tiền thu hộ tối đa 20 triệu, chọn "trừ phí vào tiền thu hộ" thì tiền
   thu hộ phải không nhỏ hơn phí.
4. **`POST /orders`**: server **tự tính lại phí** bằng cùng hàm `pricing.js`
   (không dùng số phía client gửi lên), rồi chạy **một transaction** gồm ba
   lệnh ghi: tăng bộ đếm để sinh mã vận đơn `EXP` + 10 chữ số, thêm đơn ở trạng
   thái CREATED (lưu bảng giá đã dùng), xóa bản nháp. Lỗi ở bất kỳ bước nào thì
   cả ba cùng hủy; 10 đơn tạo đồng thời ra 10 mã liên tiếp, không trùng.
5. **Nhân viên kho duyệt** trên App Nhân viên: chỉ thấy đơn của hub mình và các
   bưu cục trực thuộc. Bấm xác nhận → `POST /orders/:id/confirm` chuyển
   CREATED → CONFIRMED và ghi `fee.lockedAt`: **phí khóa từ đây**, đổi bảng
   giá về sau không làm đổi phí đơn này. Đơn đã duyệt thì không duyệt lại được.

Kiểm chứng: mỗi story có test luồng nghiệp vụ API, và một kịch bản Playwright
liên ứng dụng: khách tạo đơn trên Web → nhân viên kho Hub Hà Nội duyệt trên App
Nhân viên → phí trên đơn không đổi.

## 7. Phụ lục — Bằng chứng chi tiết Sprint 1 (US-01 → US-04)

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
| **T8** Test case, Postman, đẩy Git      | Đảm bảo code đúng tự động                                               | `tests/*.test.js`, `EDMS.postman_collection.json`               | Chạy `npm test` live → cuối Sprint 1 là `pass 33` (nay 153 test); mở Postman chạy thử 1 request           |

---

**Một câu chốt nếu hết giờ chỉ nói được một câu**: _"Hệ thống đã chạy trọn
luồng từ ước tính phí, tạo đơn đến kho duyệt đơn và khóa phí, trên nền xác
thực, phân quyền, khóa tài khoản đầy đủ — tất cả là code thật chạy được, có 153
kiểm thử API và 47 kịch bản giao diện tự động xác nhận, không phải mô tả
suông."_
