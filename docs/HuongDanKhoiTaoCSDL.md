# Khởi tạo CSDL EDMS trên MongoDB bằng code

Bạn tự tạo database `edms` trên cluster Atlas của mình bằng hai file code MongoDB, rồi nối dự án vào.
Chưa có cluster thì làm Bước 1–3 trong `HuongDanMongoAtlas.md` trước.

| File (thư mục `code/database/`) | Làm gì |
|---|---|
| `01-tao-cau-truc.mongodb.js` | Tạo 12 collection, **ràng buộc dữ liệu** (`$jsonSchema`) và **chỉ mục** |
| `02-du-lieu-mau.mongodb.js` | Nạp 271 bản ghi mẫu: 5 vai trò, 19 tài khoản test, 3 hub, 4 tuyến, 20 quận/huyện, 2 loại dịch vụ, 8 bảng giá, 10 địa điểm lấy hàng, 200 đơn hàng đủ 18 trạng thái |

## Database gồm những gì

| Collection | Chứa | Ràng buộc đáng chú ý |
|---|---|---|
| `roles` | 5 vai trò và quyền (CUSTOMER kế thừa GUEST) | `code` không trùng |
| `users` | Tài khoản mọi vai trò | `email`, `phone` không trùng; `role` chỉ nhận 5 giá trị |
| `hubs` | Điểm tập kết, bưu cục | `code` không trùng |
| `routes` | Tuyến giao nhận, năng lực mỗi ca | `code` không trùng |
| `serviceareas` | Quận/huyện được phục vụ | Một cặp tỉnh + quận chỉ xuất hiện một lần |
| `servicetypes` | Gửi thường / gửi nhanh | `code` không trùng |
| `pricetables` | Bảng giá theo vùng, các bậc khối lượng nhúng bên trong | Giá, khối lượng không âm |
| `pickuplocations` | Địa điểm lấy hàng của khách | |
| `orders` | Đơn hàng, hành trình nhúng trong `statusHistory` | Mã vận đơn không trùng; COD từ 0 đến 20.000.000 |
| `orderdrafts` | Đơn nháp | **Tự xóa sau 24 giờ** (chỉ mục TTL) |
| `assignments` | Phân công shipper | |
| `shifts` | Ca trực | |

Khi ứng dụng (hoặc bất kỳ ai) ghi dữ liệu sai ràng buộc, MongoDB **từ chối lưu**. Ví dụ: tạo
user có vai trò lạ, COD 25 triệu, đơn thiếu mã vận đơn.

## Bước 1 — Cài mongosh (một lần)

Máy bạn đã có MongoDB Compass nhưng chưa có `mongosh`, công cụ chạy file code MongoDB.
Mở PowerShell:

```powershell
winget install MongoDB.Shell
```

Đóng PowerShell, mở lại, gõ `mongosh --version` thấy số phiên bản là được.

## Bước 2 — Tạo cấu trúc

Lấy chuỗi kết nối như Bước 3 của `HuongDanMongoAtlas.md` (đã thay `<db_password>` bằng mật khẩu).

```powershell
cd "D:\nam 5 ki 1\CNPM nâng cao\lí thuyết\QuanLiGiaoHang\code\database"
mongosh "mongodb+srv://edms_app:MATKHAU@edms.xxxxx.mongodb.net/" --file 01-tao-cau-truc.mongodb.js
```

Kết quả đúng: 12 dòng `+ <tên collection>: tao moi` kèm chỉ mục, cuối cùng là
`Xong: 12 collection trong database "edms"`. Chạy lại lần nữa cũng an toàn: collection đã có thì
chỉ cập nhật ràng buộc, không xóa dữ liệu.

## Bước 3 — Nạp dữ liệu mẫu

```powershell
mongosh "mongodb+srv://edms_app:MATKHAU@edms.xxxxx.mongodb.net/" --file 02-du-lieu-mau.mongodb.js
```

Kết quả đúng: bảng số bản ghi từng collection (`users 19`, `orders 200`...).

- Database đã có dữ liệu thì script **tự dừng, không xóa gì**. Muốn xóa sạch rồi nạp lại:
  ```powershell
  mongosh "<chuỗi kết nối>" --eval "var XOA_DU_LIEU_CU=true" --file 02-du-lieu-mau.mongodb.js
  ```
- Ngày tháng tự dời theo ngày bạn chạy, nên dữ liệu lúc nào cũng như vừa tạo.

## Bước 4 — Xem kết quả

Trên Atlas → **Data Explorer**, hoặc trong Compass:

- Database `edms` có 12 collection.
- Bấm vào một collection → tab **Indexes**: thấy các chỉ mục (vd `orders` có `trackingCode_1`
  unique); tab **Validation**: thấy ràng buộc `$jsonSchema`.
- Thử ràng buộc ngay trong mongosh (gõ `mongosh "<chuỗi kết nối>"` rồi):
  ```js
  use edms
  db.users.insertOne({ email: "x@y.z", phone: "1", passwordHash: "h", fullName: "X", role: "BOSS" })
  // -> MongoServerError: Document failed validation   (role "BOSS" không hợp lệ)
  ```

## Bước 5 — Nối dự án vào database này

```powershell
cd "D:\nam 5 ki 1\CNPM nâng cao\lí thuyết\QuanLiGiaoHang\code\apps\api"
npm run atlas:setup
```

Dán chuỗi kết nối (chữ không hiện lên, đúng thiết kế), Enter. Kết quả đúng:

```
Ket noi THANH CONG.
Database "edms" co 12 collection: users=19, orders=200, serviceareas=20, pricetables=8
Da ghi MONGO_URI vao ...\.env (file nay KHONG len Git).
```

**Bỏ qua** dòng gợi ý `npm run seed -- --yes`: bạn đã nạp dữ liệu ở Bước 3 rồi (seed cũng tạo đúng
bộ dữ liệu này, nhưng bằng Node thay vì mongosh).

Chạy thử:

```powershell
npm run dev
```

Mở <http://localhost:4044/health>: phần `database` phải có `"cloud": true` và `"name": "edms"`.
Sau đó bật web/App Nhân viên như `HuongDanChayThu.md` và đăng nhập `admin@edms.vn` / `123456`:
mọi dữ liệu giờ đọc từ Atlas, qua cache 30 giây.

## Cách khác: chạy bằng VS Code thay cho mongosh

1. Cài extension **MongoDB for VS Code**.
2. Thanh bên trái → biểu tượng lá MongoDB → **Add Connection** → dán chuỗi kết nối.
3. Mở `code/database/01-tao-cau-truc.mongodb.js` → bấm nút **▶ Run** (góc trên bên phải).
   Làm tương tự với file `02`.

## Khi sửa model trong code

Hai file trên được **sinh tự động** từ model Mongoose và bộ seed. Đừng sửa tay:

```powershell
cd code/apps/api
npm run db:export        # sinh lại code/database/01 và 02 (cần Docker đang chạy)
```

`npm test` có test `[US-02] 01-tao-cau-truc.mongodb.js khop voi model`: quên sinh lại thì test báo đỏ.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `mongosh : The term 'mongosh' is not recognized` | Vừa cài xong: đóng mở lại PowerShell |
| `bad auth : authentication failed` | Sai user/mật khẩu CSDL (user ở **Database Access**, không phải tài khoản đăng nhập web Atlas) |
| Treo rồi báo `Server selection timed out` | IP chưa có trong **Network Access** |
| `Document failed validation` khi chạy file 02 | Chưa chạy file 01 bản mới nhất, hoặc file 02 cũ hơn model: chạy `npm run db:export` |
| `DA CO du lieu ... Khong xoa gi` | Đúng thiết kế. Muốn nạp lại thì thêm `--eval "var XOA_DU_LIEU_CU=true"` |
