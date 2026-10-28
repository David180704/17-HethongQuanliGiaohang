# EDMS — Express Delivery Management System

Đồ án môn Công nghệ phần mềm nâng cao. Hệ thống quản lý giao hàng cho công ty
chuyển phát nhanh, phát triển theo Scrum, một người thực hiện.

Tài liệu Scrum nằm ở `docs/`: Product Backlog, Sprint Backlog và Sprint Planning 1–3.
Mã hạng mục `#N` dưới đây tham chiếu cột `Story ID` trong sheet **Sprint backlog**.

Đề bài gốc (case study) nằm ở `docs/Case study 02_HeThongGiaoHang.pdf`. Khi có
mâu thuẫn giữa file này và case study, **case study thắng** — đã xảy ra một lần
(xem mục 7) và được sửa lại cho khớp.

---

## 1. Nghiệp vụ

Khách hàng tạo đơn giao hàng. Hệ thống tính phí theo bảng giá, phân công nhân viên
giao nhận theo tuyến và năng lực, theo dõi hành trình kiện hàng, thu hộ tiền hàng
(COD) khi giao, rồi đối soát định kỳ để xác định số tiền trả lại cho khách.

Năm vai trò:

| Vai trò | Làm gì |
|---|---|
| `GUEST` | Tra cứu vận đơn, ước tính phí, xem bảng giá — không cần đăng nhập |
| `CUSTOMER` | Kế thừa toàn bộ GUEST + tạo đơn, theo dõi đơn, xem đối soát |
| `SHIPPER` | Lấy hàng, giao hàng, thu COD, check-in vị trí — chỉ trên đơn được phân công cho chính mình |
| `HUB_STAFF` | Duyệt đơn, phân công, nhập xuất kho — chỉ trên đơn thuộc điểm mình phụ trách |
| `ADMIN` | Danh mục, bảng giá, phân quyền, đối soát |

Vòng đời đơn hàng, 18 trạng thái (tài liệu Sprint Planning gốc ghi "17", đếm lại
đúng ra 18 — xem seed data dùng đủ 18 giá trị):

```
CREATED → CONFIRMED → PICKUP_ASSIGNED → PICKED_UP → SORTED → IN_TRANSIT
        → AT_HUB → AT_DEST_HUB → DELIVERY_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED

Nhánh lỗi: PICKUP_FAILED · DELIVERY_FAILED → RESCHEDULED → RETURNING → RETURNED
Nhánh khác: CANCELLED · INCIDENT
```

Khách hàng chỉ nhìn thấy 4 nhóm: *Chưa nhận* · *Đã nhận – Chưa giao* ·
*Đã nhận – Đang giao* · *Đã giao*. Việc gom 18 → 4 làm ở tầng hiển thị.

---

## 2. Công nghệ

| Tầng | Công nghệ |
|---|---|
| Backend | Node.js 20+, Express, ESM (`"type": "module"`) |
| CSDL | MongoDB 7 **replica set** + Mongoose 8 |
| Cache, hàng đợi | Redis 7 + BullMQ |
| Xác thực | JWT: Access 15 phút, Refresh 7 ngày |
| Tài liệu API | swagger-jsdoc + swagger-ui-express |
| Kiểm thử | `node:test` (built-in) + Supertest |
| Web Khách hàng | React + Vite + TailwindCSS |
| Mobile Khách hàng | React Native (Expo) — cùng thiết kế với Web Khách hàng |
| App Nhân viên | React Native (Expo) + react-native-web, `expo-location`, `expo-camera` |

Kiến trúc client-server: **backend cung cấp một RESTful API duy nhất dùng chung**
cho mọi client (yêu cầu bắt buộc của case study, mục 1.2). Không có CSDL riêng
cho từng app — tất cả cùng gọi vào một backend, một MongoDB.

Hai sản phẩm, tách theo **đối tượng dùng** (quyết định ngày 22/10/2026, thay cho
phương án cũ "một app mobile chung cho CUSTOMER và SHIPPER"):

| Sản phẩm | Đối tượng | Đăng nhập | Nền tảng |
|---|---|---|---|
| **App Khách hàng** | GUEST, CUSTOMER | **Không bắt buộc** — chỉ đòi khi đặt đơn/thanh toán | Web (`apps/web`) + Mobile (`apps/customer-mobile`), **cùng một thiết kế** (tham khảo UI Shopee) |
| **App Nhân viên** | ADMIN, HUB_STAFF, SHIPPER | **Bắt buộc** — giao diện rẽ nhánh theo vai trò | Expo (`apps/staff`), chạy trên điện thoại và trình duyệt máy tính |

- Khách vãng lai xem được: bảng giá, loại dịch vụ, vùng phục vụ, ước tính phí,
  tra cứu vận đơn. Bấm "Tạo đơn"/"Thanh toán" mới bị chuyển sang đăng nhập/đăng ký.
- Tài khoản nhân viên đăng nhập App Khách hàng → từ chối; tài khoản CUSTOMER
  đăng nhập App Nhân viên → từ chối. Hai app không lẫn vai trò.
- App Nhân viên theo vai trò:
  - `ADMIN` → toàn bộ trang quản trị: danh mục, bảng giá, phân quyền, đối soát,
    thống kê (không còn web admin riêng — đã chuyển từ Vite sang Expo).
  - `HUB_STAFF` → duyệt đơn, phân công, nhập/xuất kho tại hub của mình.
  - `SHIPPER` → đơn trong ca, xác nhận lấy/giao, thu COD, check-in GPS
    (tham khảo UI Grab Driver/Ahamove).

### Kiểm thử song song (giao dịch thật)

Demo một giao dịch cần khách và nhân viên thao tác **cùng lúc** trên cùng dữ liệu:

- Mỗi app chạy **một cổng riêng** (web khách `:5173`, app nhân viên web `:8082`, app khách
  mobile `:8083`) vì token lưu theo origin — hai tab cùng origin sẽ ghi đè phiên của nhau.
- Điện thoại thật (Expo Go) gọi API qua **IP LAN của máy** (vd `192.168.1.10:4044`),
  không phải `localhost`; mở cổng API trên Windows Firewall.
- Màn hình cần thấy thay đổi từ phía bên kia (danh sách đơn của hub, trạng thái
  đơn của khách) **tự làm mới định kỳ 30 giây** và đọc qua cache 30 giây (yêu cầu
  ngày 28/10/2026: không gọi API liên tục). Phía bên kia thấy thay đổi **trong vòng
  30 giây**, không phải ngay — test liên app chờ tối đa 40 giây.
- Seed phải có ca trực **của ngày chạy demo** để phân công tự động tìm được shipper.
- Kiểm thử tự động: một bài Playwright mở **nhiều browser context** (mỗi context
  một vai trò) chạy trọn vòng đời đơn: khách tạo → hub duyệt → shipper lấy/giao → khách thấy DELIVERED.
  Hiện có `apps/web/tests-e2e/cross-app.spec.js`: admin thêm vùng phục vụ trên App
  Nhân viên → khách thấy ngay trên Web Khách hàng (mở rộng thành vòng đời đơn khi có module đơn hàng).

Bật toàn bộ môi trường (Docker, API, web, app nhân viên, app khách mobile, mỗi cái một cửa sổ,
in sẵn IP LAN cho điện thoại): `cd code; powershell -ExecutionPolicy Bypass -File .\start-dev.ps1`.
Thêm `-Local` để API dùng CSDL Docker (bắt buộc trước khi chạy test), `-Emulator` để bật máy ảo
và mở App Khách hàng. Kịch bản demo: `docs/KichBanDemo.md`.

**Test giao diện/máy ảo chỉ chạy khi API dùng CSDL local**: Playwright có `globalSetup`
`code/scripts/e2e-guard.mjs`, script PowerShell gọi `Assert-LocalDatabase` — cả hai đọc `/health`,
API đang nối Atlas thì dừng (bỏ chốt: `E2E_ALLOW_CLOUD=1`). Đừng gỡ: test thêm/xóa khu vực,
khóa tài khoản, đăng ký tài khoản mới.

| Thành phần | Cổng | Kiểm thử E2E |
|---|---|---|
| API | 4044 (cổng 4000 trên máy dev bị container khác chiếm) | `apps/api`: `npm test` |
| Web Khách hàng | 5173 | `apps/web`: `npm run test:e2e` |
| App Nhân viên (web) | 8082 | `apps/staff`: `npm run test:e2e` |
| App Khách hàng mobile (Expo, có bản web) | 8083 | `apps/customer-mobile`: `npm run test:e2e` |

Dev server Expo chạy với `CI=1` thì **tắt theo dõi file** — sửa code xong phải khởi
động lại, nếu không trình duyệt vẫn chạy bundle cũ và E2E kiểm tra nhầm code cũ.

### Kiểm thử trên máy ảo Android (song song với web)

Công cụ (cài trên ổ D: vì đường dẫn Android không được có dấu/khoảng trắng):
Android SDK `D:\DevTools\android-sdk` (emulator, platform-tools, image API 35),
máy ảo `edms_pixel` ở `D:\DevTools\android-avd`, Maestro 2.11 `D:\DevTools\maestro`,
Java 17, Expo Go 58.0.5 trên máy ảo. Tăng tốc dùng WHPX (sẵn có trên Windows này).

| Lệnh (trong `code/`) | Việc |
|---|---|
| `.\test-mobile.ps1 -OpenOnly -App staff` (hoặc `customer`) | Bật máy ảo (nếu chưa), nối cổng, mở app |
| `.\test-mobile.ps1` | Chạy Maestro cả 2 app: 7 flow `apps/staff/.maestro`, 8 flow `apps/customer-mobile/.maestro`; báo cáo HTML ở `maestro-report/` của từng app. Thêm `-App staff`/`customer`, `-Flow <tên>` để chạy riêng |
| `.\test-song-song.ps1` | 3 bộ Playwright + Maestro 2 app **cùng lúc**, rồi kịch bản liên thiết bị cả hai chiều |

Trong VS Code: Terminal → Run Task → `EDMS: ...` (`.vscode/tasks.json`).
Kịch bản liên thiết bị (chỉ chạy khi `E2E_MOBILE=1`): Playwright điều khiển web, gọi Maestro điều
khiển máy ảo xen kẽ — `apps/web/tests-e2e/mobile-cross.spec.js` (nhân viên trên máy ảo → khách trên
web) và `apps/customer-mobile/tests-e2e/cross-device.spec.js` (nhân viên trên web → khách trên máy ảo).

Những bẫy đã gặp (đã xử lý trong flow/script, đừng gỡ):
- Máy ảo gọi API qua `adb reverse tcp:4044/8082/8083/5173` → trong app là `127.0.0.1`.
- `inputText` của Maestro **không gõ được Unicode trên Android** → dữ liệu nhập từ máy ảo dùng chữ không dấu.
- Đường dẫn tuyệt đối có dấu truyền qua `maestro.bat` bị vỡ → luôn dùng đường dẫn tương đối.
- Nút nổi "Tools" của Expo Go đè lên nút "Đăng xuất" → `open-app.yaml` tự tắt nó.
- Gboard bật hộp thoại "Try out your stylus" → script tắt `stylus_handwriting_enabled`.
- `openLink` ngay sau `stopApp` đôi khi bị Android bỏ qua → `retry`.
- Git Bash đổi `/sdcard/...` thành đường dẫn Windows → dùng `MSYS_NO_PATHCONV=1` khi gọi adb.
- Ô nhập/chip cần `testID` (`field-<name>`, `field-<name>-<value>`) để Maestro bấm đúng.
- `name:` của flow không được chứa ký tự cấm trong tên file Windows (`: / \ | < > ? * "`): Maestro
  dùng tên flow làm thư mục báo cáo → `InvalidPathException`.
- Lần gọi adb đầu tiên sau khi bật máy in `daemon not running` ra stderr; PowerShell 5.1 với
  `ErrorActionPreference = "Stop"` + `2>$null` coi đó là lỗi và dừng script → hàm gọi adb hạ về
  `Continue` trong phạm vi hàm. adb daemon do một script có output chuyển hướng khởi động sẽ giữ
  luôn file log đó: lần chạy sau ghi log khác tên.
- Android 15 (edge-to-edge) không tự co màn hình khi bàn phím mở → ô ở cuối form dài bị che.
  Khung `Screen` của App Khách hàng bọc `KeyboardAvoidingView behavior="padding"`; flow phải
  `hideKeyboard` rồi `scrollUntilVisible` trước khi bấm ô tiếp theo.
- Khởi động nhanh từ snapshot làm máy ảo giữ ~10 GB bộ nhớ ảo (khởi động nguội ~2–4 GB); ổ C:
  máy dev gần đầy nên page file không nở được → Windows buộc dừng Vite/Playwright giữa chừng.
  Snapshot còn hay hỏng khi máy ảo bị tắt ngang → treo màn hình đen, adb `offline`.
  → `Start-EmulatorIfNeeded` luôn chạy `-no-snapshot`, máy ảo treo thì tự tắt và bật lại.

Cấu trúc thư mục:

```
code/
├── docker-compose.yml          # mongo (replset rs0) + redis
└── apps/
    ├── api/
    │   ├── src/
    │   │   ├── config/         # env, db, redis
    │   │   ├── core/           # response, errors, crudRouter
    │   │   ├── middleware/     # auth, rbac, validate
    │   │   ├── models/         # Mongoose schema
    │   │   ├── modules/        # mỗi nghiệp vụ 1 thư mục: service + router
    │   │   └── server.js
    │   └── tests/
    ├── web/                # App Khách hàng — bản web (Vite)
    ├── customer-mobile/    # App Khách hàng — bản mobile (Expo)
    └── staff/              # App Nhân viên (Expo) — ADMIN, HUB_STAFF, SHIPPER
```

Chuỗi kết nối từ máy host:

```
mongodb://localhost:27017/edms?directConnection=true
```

Không thêm `replicaSet=rs0` — replica set khởi tạo với địa chỉ nội bộ `mongo:27017`,
máy host không phân giải được tên đó.

---

## 3. Quy ước bắt buộc

### Định dạng response

```js
// thành công
{ success: true, data: {...}, meta: { page, limit, total } }

// lỗi
{ success: false, error: { code: "ORDER_OUT_OF_SERVICE_AREA", message: "..." } }
```

Mã lỗi viết HOA, gạch dưới, gom trong `src/core/errors.js`. Thông báo tiếng Việt.

### Kiến trúc lớp API (SOLID + design pattern — chi tiết `docs/KienTrucAPI.md`)

```
Router (createCrudRouter, Factory) → Controller → Service (BaseCrudService, Template Method)
  → CachedRepository (Decorator, cache 30s) → Repository (BaseRepository) → MongoDB
Service phát "catalog.changed" → EventBus (Observer) → xóa cache trang công khai
```

- Code mới **phải** theo khuôn này: validator là hàm thuần `{ create, update }`; ràng
  buộc cần đọc DB đặt ở hook `beforeCreate/beforeUpdate/beforeDelete` của service.
- Mọi phụ thuộc tiêm qua constructor; **chỉ `src/container.js`** được tạo lớp cụ thể và
  nối chúng lại. Không `import` Redis/bcrypt/JWT trực tiếp trong service.
- Đăng nhập và kiểm tra ràng buộc **không đọc qua cache** (dữ liệu phải mới nhất).
- Phía app: GET đi qua `QueryCache` (30 giây); ghi xong `invalidate(endpoint)`;
  đăng nhập/đăng xuất `clear()`.

### Dữ liệu và tài khoản test

- Tài khoản test sửa ở `src/seed/testAccounts.js`, mật khẩu chung `123456`:
  `admin`, `kho1..3`, `taixe1..5`, `khach1..6`, `shop1..4` `@edms.vn` (shop4 PENDING).
- CSDL thật có thể ở MongoDB Atlas (`MONGO_URI` trong `.env`, xem `docs/HuongDanMongoAtlas.md`).
  **Test chỉ chạy trên CSDL local** (`npm run seed:local` rồi `npm test`).
- Seed vào CSDL không phải local phải thêm `--yes` (chốt chống xóa nhầm dữ liệu cloud).

### Kiểm thử theo story

- Tên mọi test API bắt đầu bằng nhãn story: `test("[US-06] ...")`. Story chưa làm ghi
  tiêu chí dạng `test.todo` trong `tests/stories-pending.test.js`; làm xong thì đổi
  thành test thật.
- `npm run test:story -- 6` chạy riêng một story; `npm run report:stories` cập nhật
  `docs/KiemThuTheoStory.md`.
- File script không được đặt tên `test-*.js` (node --test tự chạy nhầm như file test).
- Đầu `before()` của file test gọi `removeLeftovers()` (`tests/helpers/fixtures.js`):
  lần chạy bị ngắt để lại dữ liệu test sẽ làm cả file fail vì trùng email.

### Commit

```
feat(US-13): CRUD bang gia theo vung va bac khoi luong
fix(US-09): sua middleware duyet cay ke thua quyen
test(US-17): them 10 kich ban tinh phi
chore(US-02): seed du lieu mau
```

Loại: `feat` `fix` `refactor` `test` `docs` `chore`. Commit tiếng Việt không dấu.
**Commit nhỏ, mỗi việc có nghĩa một commit** — không gom cả buổi vào một commit.

### Definition of Done

Một hạng mục chỉ được coi là xong khi đủ cả 5:

1. Mã nguồn chạy được, đã merge vào `main`
2. Thỏa toàn bộ tiêu chí chấp nhận trong Product Backlog
3. Có unit test cho phần logic nghiệp vụ, `npm test` pass
4. API đã có chú thích Swagger
5. Đã commit với mã hạng mục đúng

---

## 4. Mô hình dữ liệu — 12 collection

Thiết kế đủ 12 ngay từ đầu. Bốn collection của Sprint 5
(`checkinPoints`, `checkinLogs`, `codTransactions`, `settlements`) thêm sau.

### users
```
email          String unique
phone          String unique
passwordHash   String            // bcrypt cost 10
fullName       String
role           enum GUEST|CUSTOMER|SHIPPER|HUB_STAFF|ADMIN
status         enum PENDING|ACTIVE|LOCKED
customerType   enum INDIVIDUAL|BUSINESS     // chỉ CUSTOMER
shopName       String                        // chỉ BUSINESS
taxCode        String
hubId          ref hubs                      // chỉ HUB_STAFF
routeIds       [ref routes]                  // chỉ SHIPPER
maxPickupPerShift  Number                    // ghi đè năng lực riêng, có thể null
maxDeliveryPerShift Number
bankAccount    { bankName, accountNumber, accountName }
```

### roles
```
code           enum unique
name           String
permissions    [String]          // "order:create", "priceTable:update"
inheritsFrom   String | null     // CUSTOMER inheritsFrom GUEST
```

### serviceAreas
```
province       String
district       String            // unique cùng province
wards          [String]
region         enum BAC|TRUNG|NAM
routeId        ref routes        // một quận/huyện chỉ thuộc MỘT tuyến
```

### routes
```
code           String unique
name           String
hubId          ref hubs
maxPickupPerShift   Number       // năng lực mặc định của tuyến
maxDeliveryPerShift Number
isActive       Boolean
```

### hubs
```
code           String unique
name           String
type           enum HUB|POST_OFFICE
address, province, district
location       { lat, lng }
isActive       Boolean
```

### shifts
```
code           String
name           String
startTime      String            // "08:00"
endTime        String            // "17:00"
routeId        ref routes
shipperIds     [ref users]
shiftDate      Date
```

### serviceTypes
```
code           enum STANDARD|EXPRESS unique
name           String            // "Gửi thường" | "Gửi nhanh"
surchargeRate  Number            // hệ số phụ phí, vd 0 và 0.5
estimatedDays  Number
isActive       Boolean
```

### priceTables
```
serviceTypeId  ref serviceTypes
zone           enum INNER_DISTRICT|INNER_PROVINCE|INTER_PROVINCE|INTER_REGION
weightTiers    [{ fromGram, toGram, basePrice, pricePer500g }]   // NHÚNG
effectiveFrom  Date
effectiveTo    Date
isActive       Boolean
```

### pickupLocations
```
customerId     ref users
label          String
contactName, contactPhone
address, province, district, ward
serviceAreaId  ref serviceAreas
isDefault      Boolean
isActive       Boolean
```

### orders
```
trackingCode   String unique     // "EXP" + 10 chữ số
customerId     ref users
customerName   String            // DENORMALIZE
pickupLocationId ref pickupLocations
pickupWard     String            // DENORMALIZE
receiver       { name, phone, address, province, district, ward }
item           { name, weightGram, length, width, height,
                 declaredValue, packingType, note }
flags          { fragile, highValue, isVehicle }
serviceTypeId  ref serviceTypes
serviceName    String            // DENORMALIZE
chargeableWeight Number          // max(khối lượng thực, quy đổi)
fee            { base, weightSurcharge, serviceSurcharge,
                 specialSurcharge, total }
cod            { enabled, amount,
                 feePayer: SHOP_PREPAID|RECIPIENT_PAID|DEDUCT_FROM_COD,
                 feePaymentMethod: QR|CASH|null, feePaid, feePaidAt,
                 collected, collectedAt, method, txnRef }
status         enum (18 giá trị)
statusHistory  [{ status, at, by, note, location }]   // NHÚNG
deliveryAttempts Number
assignedTo     ref users
settlementId   ref settlements
```

### orderDrafts
```
draftToken     String unique
payload        Mixed
customerId     ref users | null
createdAt      Date              // TTL index 86400 giây
```

### assignments
```
orderId        ref orders
shipperId      ref users
type           enum PICKUP|DELIVERY|RETURN
shiftDate      Date
status         enum ASSIGNED|DONE|FAILED
assignedBy     ref users
assignedAt     Date
method         enum AUTO|MANUAL
reason         String            // bắt buộc khi MANUAL và vượt năng lực
```

### Chỉ mục bắt buộc

```js
orders.index({ trackingCode: 1 }, { unique: true })
orders.index({ customerId: 1, status: 1, createdAt: -1 })
assignments.index({ shipperId: 1, shiftDate: 1, status: 1 })
orderDrafts.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })
```

### Quy tắc nhúng hay tham chiếu

Nhúng khi luôn đọc kèm và không vượt ~20 phần tử: `statusHistory`, `weightTiers`.
Tham chiếu khi thực thể thay đổi độc lập: `customerId`, `routeId`, `serviceTypeId`.
Denormalize có chọn lọc để tránh `$lookup` ở mọi truy vấn danh sách.

---

## 5. Quy tắc nghiệp vụ không được vi phạm

### Tính phí

```
chargeableWeight = max(weightGram, (length × width × height) / 5000 × 1000)

fee.total = base                    // theo zone và bậc khối lượng
          + weightSurcharge         // pricePer500g × số bậc 500g vượt
          + serviceSurcharge        // base × serviceType.surchargeRate
          + specialSurcharge        // hàng dễ vỡ, trị giá cao
```

Bốn `zone` xác định từ cặp (nơi gửi, nơi nhận):

| zone | Điều kiện |
|---|---|
| `INNER_DISTRICT` | cùng province và cùng district |
| `INNER_PROVINCE` | cùng province, khác district |
| `INTER_PROVINCE` | khác province, cùng region |
| `INTER_REGION` | khác region |

Sau khi đơn chuyển `CONFIRMED`, **phí khóa cố định vào đơn**. Bảng giá đổi về sau
không được làm đổi phí của đơn cũ.

STANDARD và EXPRESS dùng chung một bộ `weightTiers` cho mỗi zone; chênh lệch giá
nằm hoàn toàn ở `serviceSurcharge`, tránh tính trùng phần phụ phí EXPRESS.

### Bảng giá

- Các bậc khối lượng trong cùng bảng giá **không chồng lấn và không hở khoảng trống**
- Hai bảng giá cùng `serviceTypeId` và cùng `zone` **không trùng khoảng hiệu lực**
- Bảng giá đã dùng cho đơn hàng thì không xóa được, chỉ `effectiveTo` lùi lại

### Tạo đơn

Chỉ nhận đơn nếu **cả nơi gửi lẫn nơi nhận** đều thuộc `serviceAreas` đã khai báo
(không chỉ pickup — case study yêu cầu xác định tuyến/khu vực cho cả hai chiều).

Chạy trong **transaction**, chạm `orders` + `orderDrafts` + counter sinh mã:

```js
const session = await mongoose.startSession();
await session.withTransaction(async () => {
  // MỌI lệnh ghi phải truyền { session }
});
```

Mã vận đơn `EXP` + 10 chữ số, sinh bằng **counter tăng dần trong cùng transaction**,
không dùng random rồi kiểm tra trùng.

### Thanh toán phí vận chuyển

Ba hình thức (`cod.feePayer`), đặt trong `cod` theo đúng schema (không phải trong
`fee`) vì áp dụng dù `cod.enabled` bật hay tắt — luôn phải có người trả phí ship:

- `SHOP_PREPAID` — người gửi trả trước, qua **QR** (chuyển khoản) hoặc **tiền mặt
  lúc shipper đến lấy hàng** (`cod.feePaymentMethod`, `cod.feePaid`, `cod.feePaidAt`)
- `RECIPIENT_PAID` — người nhận trả lúc giao hàng, gộp cùng lúc thu COD
- `DEDUCT_FROM_COD` — khấu trừ thẳng vào tiền thu hộ

### Thu hộ COD

- `cod.amount` > 0 khi bật, tối đa 20.000.000 đồng
- `feePayer = DEDUCT_FROM_COD` mà `cod.amount < fee.total` → **chặn lưu**, không chỉ cảnh báo
- `feePayer = RECIPIENT_PAID` → shipper thu `cod.amount + fee.total`
- Ghi nhận thu tiền chạy **cùng transaction** với việc chuyển trạng thái `DELIVERED`

### Phân quyền

- `CUSTOMER` kế thừa toàn bộ quyền `GUEST` — middleware duyệt theo cây `inheritsFrom`,
  không so khớp phẳng. Cache kết quả duyệt cây trên Redis.
- `SHIPPER` chỉ thao tác được trên đơn có `assignedTo === user.id`
- `HUB_STAFF` chỉ thao tác được trên đơn thuộc `hubId` của mình
- Ba endpoint đăng ký, đăng nhập, đặt lại mật khẩu có **guard ngược**: người đã xác thực
  truy cập thì chuyển hướng về trang chính

### Phân công tự động — chiều LẤY hàng (pickup)

```
1. Đơn → CONFIRMED
2. Xác định serviceArea từ địa chỉ lấy hàng → routeId
3. Lấy shipper đang trực ca trên tuyến đó
4. Chọn người có số đơn ASSIGNED thấp nhất VÀ chưa đạt năng lực tối đa
   Thứ tự ưu tiên năng lực: users.maxPickupPerShift → routes.maxPickupPerShift → mặc định hệ thống
5. Toàn tuyến đã đầy HOẶC không có ai trực ca → đơn vào hàng chờ UNASSIGNED + cảnh báo
6. Gán xong → đơn chuyển PICKUP_ASSIGNED
```

### Phân công tự động — chiều GIAO hàng (delivery)

Cùng thuật toán như chiều lấy hàng (bước 2–6), nhưng kích hoạt khi đơn đến
`AT_DEST_HUB`, xác định tuyến/khu vực theo **địa chỉ người nhận**, và chuyển đơn
sang `DELIVERY_ASSIGNED`. Đây là một lượt phân công **riêng biệt**, không tái sử
dụng kết quả gán ở chiều lấy hàng (shipper giao hàng thường khác shipper lấy hàng).

**Phải dùng transaction hoặc khóa** để nhiều đơn gán cùng lúc không làm vượt năng lực.

### Giao lại và hoàn hàng

- Tối đa **3 lần giao thất bại** (`deliveryAttempts`) cho một đơn — admin cấu hình
  được số này (chính sách giao lại), 3 là giá trị mặc định hệ thống
- Mỗi lần `DELIVERY_FAILED`, đơn chuyển `RESCHEDULED` để xếp lịch giao lại
- Vượt quá số lần cho phép, HOẶC người nhận từ chối nhận hàng → chuyển `RETURNING`
- `RETURNING` được phân công shipper theo đúng tuyến/khu vực như một lượt giao thường
  (`Assignment.type = RETURN`)
- Người gửi (shop) xác nhận đã nhận lại hàng → đơn chuyển `RETURNED`, kết thúc vòng đời

### Sự cố / khiếu nại

- Ghi nhận được ở bất kỳ trạng thái nào của đơn (shipper phát hiện khi vận chuyển,
  hub staff phát hiện tại điểm trung chuyển, hoặc khiếu nại từ shop/người nhận)
- Mỗi sự cố gắn với đúng một đơn hàng, có nội dung, tình trạng xử lý, kết quả
- Đơn có sự cố đang mở chuyển trạng thái `INCIDENT`; xử lý xong quay lại trạng thái
  trước đó trong vòng đời hoặc chuyển tiếp theo quyết định xử lý

### Check-in GPS

- Geofence bán kính mặc định 150m quanh mỗi `checkinPoint`
- Cùng một điểm + cùng một đơn chỉ ghi **một lần trong 30 phút**
- Mất mạng → xếp hàng cục bộ, gửi lại khi có mạng
- Có nút check-in thủ công dự phòng

### Đối soát

- Gom đơn `DELIVERED` hoặc `RETURNED` trong kỳ, chưa thuộc kỳ nào khác
- `netPayable = totalCod − phí chưa thanh toán − điều chỉnh`
- Một đơn chỉ thuộc **đúng một** kỳ đối soát
- Toàn bộ chạy trong **transaction**

### Thống kê và dashboard

- Số liệu tổng hợp theo thời gian: số đơn tạo mới, đã lấy, đang vận chuyển, đang
  chờ giao, giao thành công, giao thất bại, hoàn trả
- Phân tổ được theo shop, theo tuyến/khu vực, theo nhân viên giao nhận (năng suất)
- Doanh thu phí vận chuyển, tổng tiền thu hộ, tình trạng đối soát theo kỳ
- Đây là số liệu **tổng hợp/đọc (read-only aggregate)**, không có ràng buộc ghi nào
  mới — tính bằng MongoDB aggregation pipeline trên dữ liệu `orders`/`settlements`
  đã có sẵn, không cần bảng mới

---

## 6. Danh sách công việc theo thứ tự

Làm tuần tự. Mỗi mục là một hoặc vài commit.

### Đợt 1 — Nền tảng

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 1.1 | 12 Mongoose model + 4 chỉ mục bắt buộc | #2 |
| 1.2 | Seed: 5 vai trò, 1 admin, 3 hub staff, 5 shipper, 10 khách, 4 tuyến, 20 khu vực, 3 hub, 2 loại dịch vụ, 8 bảng giá, **200 đơn trải đủ 18 trạng thái** | #2 |
| 1.3 | `core/response.js` + `core/errors.js` + error handler tập trung | #4 |
| 1.4 | Swagger: swagger-jsdoc, mở ở `/api-docs` | #4 |
| 1.5 | CI GitHub Actions: lint → test → build | #5 |

Seed 200 đơn là bắt buộc, không bỏ qua. Thiếu nó thì tra cứu hành trình và
đối soát không có dữ liệu để demo.

### Đợt 2 — Xác thực và phân quyền

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 2.1 | `POST /auth/register` — cá nhân ACTIVE ngay, doanh nghiệp PENDING | #7 |
| 2.2 | `POST /auth/login` — bcrypt, cặp token, khóa 15 phút sau 5 lần sai (đếm trên Redis) | #6 |
| 2.3 | `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all` — blacklist Redis TTL bằng hạn còn lại | #8 |
| 2.4 | Middleware `requireAuth` + `requirePermission` duyệt cây kế thừa | #9 |
| 2.5 | Guard ngược cho 3 endpoint công khai | #9 |
| 2.6 | Giới hạn theo phạm vi: SHIPPER theo `assignedTo`, HUB_STAFF theo `hubId` | #9 |

### Đợt 3 — Danh mục

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 3.1 | `core/crudRouter.js` — factory nhận `{ model, resource, createSchema, updateSchema, searchFields, beforeDelete }` | — |
| 3.2 | CRUD users (đổi vai trò, khóa/mở) | #10 |
| 3.3 | CRUD routes + serviceAreas — chặn một quận thuộc hai tuyến | #11 |
| 3.4 | CRUD serviceTypes — chặn xóa khi đã dùng trong bảng giá | #12 |
| 3.5 | CRUD hubs | #14 |
| 3.6 | **priceTables viết riêng**, không dùng factory — 2 ràng buộc đặc thù + **8 unit test ranh giới bậc** | #13 |

### Đợt 4 — Đơn hàng

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 4.1 | CRUD pickupLocations — tối đa 10, chặn ngoài vùng phục vụ, chặn xóa khi còn đơn chưa hoàn tất | #15 |
| 4.2 | `pricingService.calculate()` + **10 unit test** | #17 |
| 4.3 | `POST /orders/estimate-fee` công khai + `orderDrafts` TTL 24h + cơ chế `draftToken` | #16 |
| 4.4 | `orderService.create()` trong transaction + sinh mã vận đơn | #18 |
| 4.5 | `POST /orders/:id/confirm` — khóa phí, chuyển CONFIRMED | #18 |
| 4.6 | Logic COD, 3 hình thức trả phí | #19 |
| 4.7 | `GET /orders` có lọc + `GET /orders/:id` kèm statusHistory | #20 |

### Đợt 5 — Vận hành

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 5.1 | BullMQ: topic `order.status.changed`, consumer ghi hành trình, có retry + dead-letter | #21 |
| 5.2 | `GET /tracking/:code` công khai — gom 18→4 trạng thái, che số điện thoại `09xx xxx 123`, rate limit 20/phút/IP | #22 |
| 5.3 | CRUD shifts | #23 |
| 5.4 | Cấu hình năng lực 3 cấp | #24 |
| 5.5 | `assignmentService.autoAssign()` chiều lấy hàng + transaction chống vượt năng lực + hàng chờ UNASSIGNED | #25 |
| 5.6 | API danh sách đơn cần lấy / cần giao theo shipper và ca | #27, #31 |
| 5.7 | Xác nhận lấy hàng, giao hàng, ghi nhận thất bại | #28, #32 |
| 5.8 | Ghi nhận thu COD cùng transaction với chuyển trạng thái | #33 |

### Đợt 6 — Check-in GPS và đối soát

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 6.1 | 4 collection mới: checkinPoints, checkinLogs, codTransactions, settlements | — |
| 6.2 | CRUD checkinPoints | #29 |
| 6.3 | API nhận sự kiện check-in + chặn trùng 30 phút | #30 |
| 6.4 | `settlementService.create()` trong transaction | #34 |

### Đợt 7 — Giao diện

| # | Việc |
|:---:|---|
| 7.1 | API công khai cho khách vãng lai: loại dịch vụ, vùng phục vụ, bảng giá |
| 7.2 | App Nhân viên (Expo): đăng nhập bắt buộc, chặn CUSTOMER, rẽ nhánh theo vai trò |
| 7.3 | App Nhân viên — ADMIN: component `ResourceScreen` nhận `{ title, endpoint, columns, fields }`, 4 trang danh mục |
| 7.4 | App Nhân viên — ADMIN: trang bảng giá riêng (lưới bậc khối lượng) |
| 7.5 | Web Khách hàng: trang chủ công khai, bảng giá, vùng phục vụ, đăng nhập/đăng ký chỉ khi đặt đơn |
| 7.6 | Web Khách hàng: tạo đơn 4 bước, danh sách đơn, chi tiết đơn, tra cứu công khai |
| 7.7 | Mobile Khách hàng (Expo): cùng màn hình và luồng với Web Khách hàng |
| 7.8 | App Nhân viên — HUB_STAFF: duyệt đơn, phân công, nhập/xuất kho |
| 7.9 | App Nhân viên — SHIPPER: đơn trong ca, xác nhận lấy/giao + thu COD, `expo-location` geofencing |
| 7.10 | Playwright nhiều context: kịch bản giao dịch song song khách ↔ nhân viên |

### Đợt 8 — Hoàn hàng, sự cố, thống kê (bổ sung sau khi đối chiếu case study)

Phát hiện khi đối chiếu Product Backlog với case study gốc (`docs/Case study
02_HeThongGiaoHang.pdf`): case study mô tả 3 luồng này là nghiệp vụ **bắt buộc**,
không phải tùy chọn — trước đó bị liệt nhầm vào mục 7 "không làm". Đã gỡ khỏi
danh sách cắt, xếp vào Sprint 6 (xem Sprint Backlog, Story #35–39).

| # | Việc | Hạng mục |
|:---:|---|:---:|
| 8.1 | `assignmentService.autoAssign()` chiều giao hàng (xem mục 5) | #35 |
| 8.2 | Cấu hình chính sách giao lại (số lần tối đa) + tự động chuyển `RETURNING` khi vượt quá/bị từ chối | #36 |
| 8.3 | Quy trình hoàn hàng: phân công `RETURN` theo tuyến, theo dõi đến khi shop xác nhận `RETURNED` | #37 |
| 8.4 | `incidentService`: ghi nhận sự cố/khiếu nại, gắn với đơn, theo dõi xử lý/kết quả | #38 |
| 8.5 | API thống kê tổng hợp (aggregation) + trang dashboard admin | #39 |

---

## 7. Phạm vi — không làm

Các mục sau đã được quyết định cắt sang Release 1.1, **không tự ý thêm vào**:

- Tạo đơn hàng loạt từ Excel
- In vận đơn PDF
- Push notification
- Đa ngôn ngữ, dark mode, animation

~~Báo cáo/dashboard/thống kê, Sự cố/khiếu nại, Hoàn hàng/giao lại~~ — **đã gỡ
khỏi danh sách này** sau khi đối chiếu case study gốc (case study yêu cầu bắt
buộc, không phải tùy chọn). Xem Đợt 8.

---

## 8. Những chỗ thường làm sai

| Chỗ | Lỗi hay gặp |
|---|---|
| Bảng giá | Nhầm `<` với `<=` ở ranh giới giữa hai bậc khối lượng |
| Tạo đơn | Quên truyền `{ session }` vào từng lệnh ghi trong transaction |
| Phân công | Không khóa khi nhiều đơn cùng gán một shipper → vượt năng lực |
| Phân công | Chỉ làm chiều lấy hàng, quên chiều giao hàng cần một lượt autoAssign riêng |
| Phân quyền | So khớp quyền phẳng thay vì duyệt cây `inheritsFrom` |
| Phân quyền | Quên "*" là ký hiệu wildcard của ADMIN trong `requirePermission` |
| Check-in | Quên chặn trùng 30 phút → GPS dao động sinh hàng chục mốc trùng |
| Kết nối Mongo | Thêm `replicaSet=rs0` vào chuỗi kết nối từ host → treo |
| Đối soát | Gom nhầm đơn đã thuộc kỳ khác |
| crudRouter | Áp `select` (ẩn field nhạy cảm) chỉ ở GET, quên áp luôn cho response của POST/PUT |
| Điều hướng web | react-router mặc định đổi URL trong `startTransition` (chậm hơn `setState`): đổi trạng thái đăng nhập rồi `navigate()` thì route guard chạy trước, đè mất đích đến. Web đã đặt `<BrowserRouter useTransitions={false}>`, đừng gỡ |
| Cache phía app | `clear()`/`invalidate()` chỉ xóa dữ liệu đã lưu mà quên bỏ request đang chạy → kết quả của người dùng trước, hoặc từ trước khi ghi, lọt vào cache |
| Test giao diện | Kiểm một trạng thái chỉ thoáng qua (link hiện 1 khung hình) → pass/fail tùy máy nhanh hay chậm. Kiểm trạng thái cuối, và thử gỡ bản sửa xem test có fail không |
| Tài liệu Scrum | Ghi "Done" theo lịch dự kiến khi chưa có code (đã xảy ra với US-13, US-14 ở Sprint Planning 2–3). Chỉ ghi Done khi đủ Definition of Done; đối chiếu bằng `npm run report:stories` |

Khi viết các phần này, **viết unit test trước khi dựng giao diện**.

---

## 9. Trước khi coi là xong một đợt

```bash
cd code && docker compose ps          # mongo + redis phải healthy
cd apps/api && npm run lint           # kiểm tra MÃ THOÁT, không nối qua pipe (| tail nuốt mất lỗi)
npm test                              # toàn bộ pass (todo là story chưa làm, không phải lỗi)
npm run report:stories                # cập nhật docs/KiemThuTheoStory.md
git add -A && git status              # không được có node_modules
git commit -m "feat(US-xx): ..."
```
