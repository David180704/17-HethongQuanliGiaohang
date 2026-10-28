# Hướng dẫn đưa dữ liệu EDMS lên MongoDB Atlas (cloud)

Bạn là người **tạo và quản lý** cluster Atlas. Code đã sẵn sàng: chỉ cần đổi một dòng
`MONGO_URI` trong file `.env` là API chuyển sang dùng dữ liệu trên cloud.

## Mô hình hoạt động

```
 Web Khách hàng ─┐   cache 30 giây trong trình duyệt / app
 App Nhân viên ──┼──► API (máy bạn, cổng 4044) ──► Redis (máy bạn) ──► MongoDB Atlas (cloud)
 Điện thoại ─────┘                                  cache 30 giây        dữ liệu thật
```

- **Dữ liệu thật nằm trên Atlas.** Mọi app dùng chung một nguồn.
- **API "cache xuống" Redis 30 giây**: cùng một câu hỏi trong 30 giây thì Redis trả lời,
  không gọi lên cloud. Admin sửa danh mục thì cache liên quan bị xóa ngay.
- **Mỗi app cũng giữ dữ liệu 30 giây** và tự làm mới mỗi 30 giây, không gọi API liên tục.
- Gói miễn phí (Free, trước gọi là M0) giới hạn **100 thao tác/giây, 0,5 GB, 500 kết nối**. Hai lớp cache
  ở trên giúp app không chạm trần này.

## Bước 1 — Tạo tài khoản và cluster miễn phí

1. Vào <https://www.mongodb.com/cloud/atlas/register>, đăng ký (miễn phí, không cần thẻ).
2. Trong **Project Overview**, bấm **Create**.
3. Chọn gói **Free** (tài liệu cũ gọi là **M0**).
4. **Provider:** AWS. **Region:** chọn **Singapore (ap-southeast-1)**, gần Việt Nam nhất.
5. **Name:** `edms` (không đổi được sau khi tạo).
6. Bấm **Create**. Khoảng 15 giây sau cluster sẵn sàng, Atlas mở **Security Quickstart**.

## Bước 2 — Tạo user CSDL và cho phép máy bạn kết nối

Ngay trong Security Quickstart:

1. **Username:** `edms_app`. **Password:** bấm tạo tự động rồi **sao chép lưu lại**.
   Nên dùng mật khẩu chỉ gồm chữ và số. Ký tự `@ : / ? #` phải mã hóa URL
   (ví dụ `@` thành `%40`) khi đưa vào chuỗi kết nối.
2. Bấm **Create Database User**.
3. **IP Access List:** bấm **Add My Current IP Address**, rồi **Finish and Close**.

> Đổi mạng (ở nhà, ở trường, 4G) là đổi IP, nên phải vào **Network Access** thêm IP mới.
> Có thể thêm `0.0.0.0/0` (mọi IP) để demo nhanh, nhưng khi đó chỉ còn mật khẩu bảo vệ dữ liệu.
> Xong buổi demo nên xóa dòng đó đi.

## Bước 3 — Lấy chuỗi kết nối

1. Mở **Clusters** → ở cluster `edms` bấm **Connect** → **Drivers** → chọn **Node.js**.
2. Sao chép chuỗi có dạng:
   ```
   mongodb+srv://edms_app:<db_password>@edms.abcde.mongodb.net/?retryWrites=true&w=majority&appName=edms
   ```
3. Sửa hai chỗ:
   - thay `<db_password>` bằng mật khẩu ở Bước 2
   - thêm `edms` ngay sau `.mongodb.net/` để dùng database tên `edms`:
   ```
   mongodb+srv://edms_app:MatKhau123@edms.abcde.mongodb.net/edms?retryWrites=true&w=majority&appName=edms
   ```

## Bước 4 — Cấu hình API dùng Atlas

1. Trong `code/apps/api`, chép `.env.example` thành `.env` (nếu chưa có).
2. Sửa dòng `MONGO_URI=` thành chuỗi ở Bước 3.
3. **Không bao giờ commit file `.env`.** Repo đã chặn file này bằng `.gitignore`, vì
   trong đó có mật khẩu CSDL.

## Bước 5 — Đổ dữ liệu mẫu lên cloud (seed)

```powershell
cd code/apps/api
npm run seed -- --yes
```

- Seed **xóa sạch** dữ liệu cũ rồi tạo lại: 5 vai trò, 19 tài khoản test, danh mục,
  bảng giá, 200 đơn hàng đủ 18 trạng thái, và toàn bộ chỉ mục.
- Không có `--yes` thì lệnh từ chối chạy trên CSDL không phải local. Đây là chốt chống
  xóa nhầm dữ liệu thật.
- Tài khoản test (mật khẩu `123456`): `admin@edms.vn`, `kho1..3@edms.vn`,
  `taixe1..5@edms.vn`, `khach1..6@edms.vn`, `shop1..4@edms.vn`.

## Bước 6 — Chạy và kiểm tra

```powershell
npm run dev
```

Mở <http://localhost:4044/health>, phần `database` phải có `"cloud": true` và
`host` kết thúc bằng `mongodb.net`.

**Xem cache hoạt động**, gọi hai lần liên tiếp:

```powershell
curl.exe -i "http://localhost:4044/public/service-types"
```

Lần đầu header là `X-Cache: MISS` (đọc từ Atlas), lần sau là `X-Cache: HIT` (Redis trả lời,
không gọi lên cloud). Trên web, các trang có dòng *"Cập nhật lúc … · tự làm mới mỗi 30 giây"*.

## Quản lý dữ liệu hằng ngày

| Việc | Cách làm |
|---|---|
| Xem / sửa dữ liệu | Atlas → **Data Explorer** (Browse Collections), hoặc **MongoDB Compass** dán chuỗi kết nối |
| Thêm, sửa tài khoản test | Sửa `code/apps/api/src/seed/testAccounts.js` rồi seed lại |
| Sao lưu | Bật **Backup** trên cluster Free (mặc định tắt; bật thì chụp mỗi ngày, giữ 4 bản gần nhất), hoặc `mongodump --uri "<chuỗi>" --out backup` |
| Khôi phục | `mongorestore --uri "<chuỗi>" backup` |
| Theo dõi tải | Atlas → cluster → **Metrics**: xem số thao tác/giây so với trần 100 |

## Test luôn chạy trên CSDL local, không chạy trên Atlas

`npm test` tạo rồi xóa dữ liệu thử nghiệm, nên **không được chạy trên dữ liệu thật**.
Các file test kết nối thẳng tới MongoDB trong Docker trên máy bạn:

```powershell
cd code
docker compose up -d          # Mongo + Redis local
cd apps/api
npm run seed:local            # dữ liệu mẫu cho CSDL local
npm test
```

## Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| `querySrv ENOTFOUND` | Mạng/DNS không phân giải được địa chỉ Atlas | Kiểm tra Internet; thử mạng khác |
| `bad auth : authentication failed` | Sai user/mật khẩu, hoặc mật khẩu có ký tự đặc biệt chưa mã hóa | Đặt lại mật khẩu chỉ gồm chữ + số |
| `Could not connect to any servers` / timeout | IP chưa có trong **Network Access** | Thêm IP hiện tại (Bước 2) |
| Treo lâu ở mạng trường/công ty | Tường lửa chặn cổng 27017 | Dùng mạng khác (4G) |
| Thỉnh thoảng chậm hẳn | Vượt 100 thao tác/giây của gói Free, Atlas giảm tốc | Giữ cache bật (`CACHE_TTL_SECONDS=30`) |

## Bảo mật

- Chuỗi kết nối chứa mật khẩu: chỉ để trong `.env`, không gửi qua chat, không chụp màn hình.
- Mật khẩu `123456` chỉ dành cho dữ liệu thử nghiệm. Khi đưa hệ thống cho người ngoài dùng,
  phải đổi mật khẩu các tài khoản hoặc seed bộ tài khoản khác.
- User `edms_app` chỉ cần quyền đọc/ghi database `edms`, không cần quyền quản trị Atlas.
