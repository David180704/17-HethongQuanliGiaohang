# Hướng dẫn chạy thử từng phần

Mỗi phần chạy độc lập được. Làm phần **0** một lần trên máy, sau đó chạy phần nào cần.
Kịch bản trình diễn từng bước cho buổi Sprint Review: [KichBanDemo.md](KichBanDemo.md).

| Phần | Là gì | Mở ở đâu |
|---|---|---|
| A | Backend API + test API | <http://localhost:4044/api-docs> |
| B | Web Khách hàng | <http://localhost:5173> |
| C | App Nhân viên trên trình duyệt | <http://localhost:8082> |
| D | App Nhân viên trên máy ảo Android | cửa sổ máy ảo |
| E | App Nhân viên trên điện thoại thật | Expo Go |
| F | App Khách hàng mobile (máy ảo, điện thoại thật, trình duyệt) | máy ảo, Expo Go, <http://localhost:8083> |
| G | Test song song web + máy ảo + liên thiết bị | một lệnh |

## Tài khoản test — mật khẩu chung `123456`

Đăng nhập bằng email **hoặc** số điện thoại.

| Vai trò | Email | Điện thoại | Dùng ở |
|---|---|---|---|
| Quản trị | `admin@edms.vn` | 0900000000 | App Nhân viên |
| Nhân viên kho | `kho1@edms.vn` … `kho3@edms.vn` | 0900000011 … 13 | App Nhân viên |
| Tài xế | `taixe1@edms.vn` … `taixe5@edms.vn` | 0900000021 … 25 | App Nhân viên |
| Khách cá nhân | `khach1@edms.vn` … `khach6@edms.vn` | 0900000031 … 36 | Web + App Khách hàng |
| Shop | `shop1@edms.vn` … `shop3@edms.vn` | 0900000041 … 43 | Web + App Khách hàng |
| Shop chờ duyệt | `shop4@edms.vn` | 0900000044 | không đăng nhập được (đúng thiết kế) |

Tài khoản nhân viên vào Web/App Khách hàng bị từ chối, khách vào App Nhân viên cũng bị từ chối.
Đây là thiết kế: hai app không dùng lẫn vai trò.

---

## 0. Chuẩn bị (một lần)

Cần có: **Docker Desktop**, **Node.js 20+**, **Git**. Java 17, Android SDK và Maestro đã cài
sẵn trên máy này (xem CLAUDE.md, mục *Kiểm thử trên máy ảo Android*).

```powershell
cd code
docker compose up -d                       # MongoDB + Redis
cd apps/api;   npm install; npm run seed:local; cd ../..
cd apps/web;   npm install; cd ../..
cd apps/staff; npm install; cd ../..
cd apps/customer-mobile; npm install; cd ../..
```

Muốn bật **tất cả** (Docker, API, Web Khách hàng, App Nhân viên, App Khách hàng mobile — mỗi cái
một cửa sổ) bằng một lệnh:

```powershell
cd code
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1             # API dùng CSDL trong .env (Atlas nếu đã nối) — để DEMO
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1 -Local      # API dùng CSDL local (Docker) — trước khi chạy TEST
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1 -Emulator   # thêm: bật máy ảo Android, mở App Khách hàng
```

Trong VS Code: **Terminal → Run Task → `EDMS: 1. DEMO ...`** (bật hết + máy ảo) hoặc
**`EDMS: 1b. TEST ...`** (CSDL local).

> **Test tự động chỉ chạy trên CSDL local.** Mọi lệnh test (Playwright, Maestro, test song song)
> đọc `http://localhost:4044/health` trước; API đang nối MongoDB Atlas thì dừng ngay, không ghi
> dữ liệu thử (khu vực, tài khoản đăng ký) lên CSDL thật. Tắt cửa sổ API rồi chạy `start-dev.ps1 -Local`.

---

## A. Backend API và test API

```powershell
cd code/apps/api
npm run dev                 # chạy API ở cổng 4044, sửa code tự khởi động lại
```

- Tài liệu và thử API trực tiếp: <http://localhost:4044/api-docs>
- Tình trạng hệ thống, đang dùng CSDL nào: <http://localhost:4044/health>

**Test API** (mở cửa sổ khác, API không cần đang chạy):

```powershell
npm test                    # toàn bộ: 93 test + 34 tiêu chí chờ làm (todo)
npm run test:story -- 6     # chỉ story US-06 (đăng nhập)
npm run test:story -- 10 11 # nhiều story
npm run test:story -- CACHE # phần cache 30 giây
npm run report:stories      # chạy hết + cập nhật docs/KiemThuTheoStory.md
npm run lint                # kiểm tra quy ước code
```

Đọc kết quả: `pass` là đạt, `fail` là lỗi (kèm dòng lỗi), `todo` là tiêu chí của story chưa làm.

## B. Web Khách hàng

```powershell
cd code/apps/web
npm run dev                 # http://localhost:5173
```

Thử nhanh:
1. Chưa đăng nhập: xem trang chủ, **Bảng giá** (đổi Giao hàng nhanh thì giá đổi), **Vùng phục vụ**.
2. Bấm **Tạo đơn**: bị chuyển sang đăng nhập. Đăng nhập `khach1@edms.vn` / `123456` thì quay lại đúng trang tạo đơn.
3. Dưới các trang có dòng *"Cập nhật lúc … · tự làm mới mỗi 30 giây"*: dữ liệu lấy từ cache.

**Test tự động** (cần API và web đang chạy):

```powershell
npm run test:e2e                         # 14 kịch bản
npx playwright test --headed             # xem trình duyệt tự bấm
npx playwright test --ui                 # bảng điều khiển, tua từng bước
```

Ảnh chụp từng bước nằm ở `code/apps/web/tests-e2e/screenshots/`.

## C. App Nhân viên trên trình duyệt

```powershell
cd code/apps/staff
npm run web                 # http://localhost:8082
```

Màn hình đăng nhập có nút **Điền nhanh**: Quản trị / Nhân viên kho / Tài xế.
Admin thấy 4 danh mục, kho thấy hub phụ trách, tài xế thấy thẻ ca hôm nay.

**Test tự động:** `npm run test:e2e` (13 kịch bản, cần API và `npm run web` đang chạy).

## D. App Nhân viên trên máy ảo Android

Cần API và Metro (`npm start` trong `apps/staff`) đang chạy.

```powershell
cd code
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -OpenOnly -App staff   # bật máy ảo + mở App Nhân viên
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App staff             # chạy 7 flow Maestro
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App staff -Flow 06-admin-crud-khu-vuc
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1                        # cả 2 app: 7 + 8 flow
```

- Script tự bật máy ảo nếu chưa chạy (lần đầu khoảng 1 phút), nối cổng, rồi mở app trong Expo Go.
- Báo cáo HTML: `code/apps/staff/maestro-report/bao-cao.html`.
- Muốn chọn phần tử trên máy ảo để viết flow mới: VS Code Task `EDMS: Maestro Studio`.

## E. App Nhân viên trên điện thoại thật

1. Cài **Expo Go** từ CH Play / App Store.
2. Điện thoại và máy tính **cùng một Wi-Fi**.
3. Chạy `start-dev.ps1` (phần 0). Cửa sổ *EDMS App Nhan vien* hiện mã QR, quét bằng Expo Go.
4. Không kết nối được thì mở PowerShell **Run as Administrator** và chạy một lần:
   ```powershell
   New-NetFirewallRule -DisplayName 'EDMS dev' -Direction Inbound -Protocol TCP -LocalPort 4044,5173,8082,8083 -Action Allow -Profile Private
   ```

## F. App Khách hàng mobile

App Expo (`code/apps/customer-mobile`, cổng 8083) cùng thiết kế với Web Khách hàng: thanh tab
Trang chủ · Bảng giá · Vùng phục vụ · Tài khoản; khách vãng lai xem được hết, bấm **Tạo đơn**
mới phải đăng nhập/đăng ký.

```powershell
cd code/apps/customer-mobile
npm start                   # Metro cổng 8083 (máy ảo / điện thoại thật quét QR)
npm run web                 # bản trình duyệt: http://localhost:8083

cd code
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -OpenOnly -App customer   # mở trên máy ảo
powershell -ExecutionPolicy Bypass -File .\test-mobile.ps1 -App customer             # chạy 8 flow Maestro
```

- Màn hình đăng nhập có nút **Điền nhanh** (khach1, shop1) khi chạy chế độ dev.
- Test trình duyệt: `npm run test:e2e` trong `apps/customer-mobile` (7 kịch bản, khung điện thoại 390×844).
- Báo cáo Maestro: `code/apps/customer-mobile/maestro-report/bao-cao.html`; ảnh chụp từng bước nằm
  trong `maestro-report/chi-tiet/`.
- Điện thoại thật: quét mã QR trong cửa sổ *EDMS App Khach hang :8083* bằng Expo Go (cùng Wi-Fi).

## G. Test song song web + mobile

```powershell
cd code
powershell -ExecutionPolicy Bypass -File .\test-song-song.ps1          # khoảng 25 phút
powershell -ExecutionPolicy Bypass -File .\test-song-song.ps1 -OnlyCross
```

Cần chạy trước: `start-dev.ps1 -Local` (API CSDL local, web 5173, Metro 8082 + 8083).

- Giai đoạn 1 — chạy **cùng lúc**: 3 bộ Playwright trên trình duyệt (Web Khách hàng, App Nhân viên,
  App Khách hàng) và Maestro trên máy ảo (App Nhân viên 7 flow, App Khách hàng 8 flow).
- Giai đoạn 2 — kịch bản **liên thiết bị**, như giao dịch thật:
  - Nhân viên trên **máy ảo** thêm/xóa khu vực, khóa/mở `khach3` → khách trên **web** thấy ngay.
  - Nhân viên trên **web** khóa/mở `khach4`, thêm/xóa khu vực → khách trên **máy ảo** (App Khách hàng) thấy ngay.
- Log: `code/test-logs/web.log`, `code/test-logs/mobile.log`.

---

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `failed to connect to the docker API` | Mở Docker Desktop, chờ khoảng 1 phút |
| Test API treo không kết thúc | Docker chưa chạy (Mongo/Redis); Ctrl+C rồi bật Docker |
| Web báo *Không kết nối được máy chủ* | API chưa chạy: `npm run dev` trong `apps/api` |
| Sửa code App Nhân viên mà trình duyệt vẫn chạy bản cũ | Expo đang chạy với `CI=1` (tắt theo dõi file); tắt và chạy lại `npm run web` |
| Cổng 4000 không dùng được | Máy này có container khác chiếm cổng 4000; API đã dùng 4044 |
| Đăng nhập báo *khóa 15 phút* | Sai mật khẩu 5 lần: chờ 15 phút, hoặc gỡ ngay bằng `docker exec edms-redis redis-cli DEL login:lock:khach1@edms.vn login:fail:khach1@edms.vn` (thay đúng email) |
| Đang bật máy ảo thì Vite/Metro/API tự tắt, trang web trắng, hoặc Playwright báo `worker process exited unexpectedly (code=3221226505)` | Hết bộ nhớ ảo, không phải lỗi code: page file của Windows nằm trên ổ C: gần đầy nên không nở thêm được. Script đã bật máy ảo kiểu **khởi động nguội** (giữ khoảng 2–4 GB, so với ~10 GB khi khởi động nhanh từ snapshot), nên chỉ bật máy ảo bằng script, không bật bằng Android Studio. Tắt máy ảo khi không dùng: `D:\DevTools\android-sdk\platform-tools\adb.exe emu kill`. Lâu dài: dọn ổ C: (nên trống từ 20 GB) hoặc đặt page file sang ổ D: (*System Properties → Advanced → Performance → Virtual memory*) |
| Test báo *API đang dùng CSDL cloud* rồi dừng | Đúng thiết kế (chốt chống ghi dữ liệu thử lên Atlas): tắt cửa sổ API, chạy `start-dev.ps1 -Local` |
| Máy ảo treo màn hình đen, `adb devices` báo `offline` | Script tự xử lý: chờ 60 giây, tắt máy ảo treo rồi khởi động nguội lại. Nếu vẫn không lên sau 4 phút thì xem dòng trên (thiếu bộ nhớ ảo) |
