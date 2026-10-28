# Kịch bản demo — Sprint 1 và Sprint 2

Dùng cho buổi Sprint Review: khoảng **15 phút**, trình diễn trên **trình duyệt** và **máy ảo Android**
cùng lúc, tất cả gọi chung một API. Tài khoản test mật khẩu chung `123456`.

| Vai trò | Tài khoản | Ứng dụng |
|---|---|---|
| Quản trị | `admin@edms.vn` | App Nhân viên |
| Nhân viên kho / tài xế | `kho1@edms.vn` / `taixe1@edms.vn` | App Nhân viên |
| Khách cá nhân / shop | `khach1@edms.vn` … `khach6@edms.vn` / `shop1@edms.vn` | Web + App Khách hàng |

## Chuẩn bị (5 phút trước giờ demo)

1. Mở **Docker Desktop**, chờ chạy xong.
2. Bật toàn bộ môi trường và máy ảo bằng một lệnh:

   ```powershell
   cd code
   powershell -ExecutionPolicy Bypass -File .\start-dev.ps1 -Emulator          # API theo .env (Atlas nếu đã nối)
   powershell -ExecutionPolicy Bypass -File .\start-dev.ps1 -Emulator -Local   # hoặc: dữ liệu local
   ```

   Trong VS Code: **Terminal → Run Task → `EDMS: 1. DEMO ...`**. Script mở 5 cửa sổ (API, Web
   Khách hàng, App Nhân viên, App Khách hàng, Docker), bật máy ảo (khoảng 40 giây) rồi mở App
   Khách hàng trong Expo Go.
3. Mở sẵn các tab trình duyệt:
   - Swagger: <http://localhost:4044/api-docs>
   - Web Khách hàng: <http://localhost:5173>
   - App Nhân viên: <http://localhost:8082>
4. Kiểm tra nhanh <http://localhost:4044/health>: `database.cloud` cho biết đang dùng Atlas hay local.

> Demo trên Atlas thì các thao tác thêm khu vực, khóa tài khoản ghi thẳng vào CSDL thật — nhớ
> xóa khu vực demo và mở khóa tài khoản ở cuối buổi (bước 2.5).

## Phần 1 — Sprint 1: nền móng kỹ thuật (3 phút)

1. **Swagger UI** → `POST /auth/login` → *Try it out* với `admin@edms.vn` / `123456` → nhận
   `accessToken` + `refreshToken` (Access 15 phút, Refresh 7 ngày).
2. Bấm **Authorize**, dán access token → `GET /auth/me` trả hồ sơ admin.
3. Thử đăng nhập sai mật khẩu → response lỗi chuẩn
   `{ success: false, error: { code: "INVALID_CREDENTIALS", message: "…" } }`, thông báo tiếng Việt.
4. Nói về dữ liệu: 12 collection, MongoDB replica set (transaction), seed 200 đơn đủ 18 trạng thái.

## Phần 2 — Sprint 2: tài khoản, phân quyền, danh mục (10 phút)

**2.1 Khách vãng lai trên máy ảo (App Khách hàng)**

1. Trang chủ: 2 dịch vụ, số quận/huyện đang phục vụ — không cần đăng nhập.
2. Tab **Bảng giá** → chọn **Giao hàng nhanh**: giá tăng 50% (15.000 ₫ → 22.500 ₫).
3. Tab **Vùng phục vụ** → gõ `hoan kiem` (không dấu) → ra **Hoàn Kiếm**; gõ `Atlantis` → báo chưa phục vụ.
4. Về Trang chủ, bấm **Tạo đơn ngay** → chuyển sang đăng nhập → **Điền nhanh khach1** → quay lại
   đúng màn hình Tạo đơn (*"Đang đăng nhập: Khách Hàng 1"*).

**2.2 Đăng ký (máy ảo)**

1. Tab **Tài khoản** → Đăng xuất → **Đăng ký** → chọn **Doanh nghiệp / shop**: hiện thêm ô tên shop
   và mã số thuế, ghi chú *cần quản trị viên duyệt*.
2. Nhập email `khach1@edms.vn` → **Đăng ký** → báo *"Email đã được sử dụng"*.

**2.3 Phân quyền (App Nhân viên trên trình duyệt)**

1. Đăng nhập `khach1@edms.vn` → bị từ chối: tài khoản khách không dùng App Nhân viên.
2. `admin@edms.vn` → trang quản trị 4 danh mục, số bản ghi thật. Đăng xuất.
3. `kho1@edms.vn` → thấy hub phụ trách; `taixe1@edms.vn` → thấy tuyến và ca hôm nay. Cả hai
   không có menu quản trị.

**2.4 Giao dịch song song: nhân viên trên web ↔ khách trên máy ảo**

1. Web (admin) → **Khu vực phục vụ** → **Thêm**: tỉnh `Tinh Demo`, quận `Quan Demo`, chọn miền và tuyến phụ trách → Lưu.
2. Máy ảo → tab **Vùng phục vụ** → gõ `quan demo` → khu vực mới hiện ra (tự làm mới trong 30 giây,
   bấm **Làm mới** để thấy ngay).
3. Web (admin) → **Người dùng** → sửa **Khách Hàng 4** → trạng thái **Đã khóa** → Lưu.
4. Máy ảo → đăng nhập `khach4@edms.vn` → *"Tài khoản đã bị quản trị viên khóa"*. Đổi lại **Hoạt động** trên web →
   đăng nhập lại được.

**2.5 Dọn dữ liệu demo**: xóa khu vực `Quan Demo`, kiểm tra `khach4` đã ở trạng thái **Hoạt động**.

## Phần 3 — Kiểm thử tự động (nếu còn thời gian)

```powershell
cd code
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App customer -Flow 03-vung-phuc-vu
```

Maestro tự gõ và bấm trên máy ảo. Kết quả đầy đủ: `docs/BaoCaoKiemThu_Sprint1-2.docx`,
`docs/KiemThuTheoStory.md`. Test tự động cần API dùng CSDL local (`start-dev.ps1 -Local`).

## Gặp sự cố khi demo

| Hiện tượng | Xử lý nhanh |
|---|---|
| Máy ảo màn hình đen hoặc chưa mở app | `.\test-mobile.ps1 -OpenOnly -App customer` (tự khởi động nguội lại) |
| App trên máy ảo báo không kết nối máy chủ | Cửa sổ API còn chạy không; chạy lại lệnh trên để nối lại cổng `adb reverse` |
| Đăng nhập báo khóa 15 phút | Sai mật khẩu 5 lần: `docker exec edms-redis redis-cli DEL login:lock:<email> login:fail:<email>` |
| Trang web trắng / Metro tự tắt khi bật máy ảo | Thiếu bộ nhớ ảo (ổ C: gần đầy) — xem `HuongDanChayThu.md`, mục *Lỗi thường gặp* |
