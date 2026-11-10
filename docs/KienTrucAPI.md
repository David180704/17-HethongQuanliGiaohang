# Kiến trúc API: SOLID và Design Pattern

Mã nguồn: `code/apps/api/src`. Mỗi lớp một trách nhiệm, phụ thuộc được tiêm qua constructor.
Toàn bộ việc nối các lớp với nhau nằm ở **một file duy nhất**: `container.js`.

## Luồng một request

```
HTTP ──► Router ──► Controller ──► Service ──► CachedRepository ──► Repository ──► MongoDB
        (Factory)   (dịch HTTP)   (nghiệp vụ,   (Decorator:           (truy vấn)
                                  Template      cache 30 giây)
                                  Method)
                                     │
                                     └─ phát sự kiện ──► EventBus (Observer) ──► xóa cache liên quan
```

Ví dụ `POST /serviceAreas` (admin thêm quận):
1. `createCrudRouter` chạy chuỗi middleware `requireAuth`, rồi `requirePermission("serviceAreas:manage")`.
2. `CrudController.create` lấy `req.body` và gọi service.
3. `ServiceAreaService.create` (khung có sẵn ở `BaseCrudService`):
   validator kiểm tra → hook `beforeCreate` chặn quận đã thuộc tuyến khác → lưu → phát sự kiện `catalog.changed`.
4. `CachedRepository` ghi xuống `ServiceAreaRepository`, rồi xóa cache danh sách quản trị.
5. Subscriber trong `container.js` nghe `catalog.changed`, xóa cache trang công khai `public:serviceAreas`,
   nên khách thấy quận mới ở lần đọc kế tiếp.

## Design pattern đã dùng

| Pattern | Ở đâu | Giải quyết vấn đề gì |
|---|---|---|
| **Repository** | `core/BaseRepository.js`, `modules/*/…Repository.js` | Service không gọi thẳng Mongoose; đổi CSDL chỉ sửa tầng này |
| **Decorator** | `core/CachedRepository.js` | Thêm cache vào repository mà không sửa repository; bật/tắt cache theo từng chỗ dùng |
| **Template Method** | `core/BaseCrudService.js` | Quy trình CRUD cố định; lớp con (`UserService`, `ServiceTypeService`…) chỉ ghi đè hook `beforeCreate/beforeUpdate/beforeDelete` |
| **Strategy** | validator `{ create, update }` mỗi danh mục; kho cache `RedisCacheStore` / `MemoryCacheStore` | Đổi cách kiểm tra dữ liệu hay nơi lưu cache mà không sửa service |
| **Adapter** | `infrastructure/`: `RedisCacheStore`, `BcryptPasswordHasher`, `JwtTokenService`, `MailService` | Bọc thư viện ngoài (ioredis, bcrypt, jsonwebtoken, nodemailer) sau giao diện nhỏ |
| **Observer** | `core/EventBus.js` + subscriber trong `container.js` | Danh mục đổi thì xóa cache liên quan; service không cần biết ai đang nghe |
| **Factory** | `core/createCrudRouter.js`, các hàm `build…Router` | Mỗi danh mục chỉ khai báo một lần, dùng chung chuỗi middleware |
| **Singleton** | `getContainer()`, `getRedis()` | Cả tiến trình dùng chung một kết nối Redis, một EventBus |
| **Proxy** (phía app) | `apps/web/src/lib/queryCache.js`, `apps/staff/src/lib/queryCache.js` | Đứng trước `apiClient`: giữ kết quả 30 giây, gộp request trùng |
| **Chain of Responsibility** | Middleware Express: `requireAuth` → `requirePermission` → controller | Mỗi mắt xích kiểm một điều kiện, sai thì dừng chuỗi |
| **Dependency Injection** | `container.js` (Composition Root) | Lớp nhận phụ thuộc qua constructor; test thay được bằng bản giả |
| **Unit of Work** (qua Adapter) | `infrastructure/db/MongooseTransactionRunner.js` | Service gọi `transactions.run(session => …)` và truyền `{ session }` cho mọi lệnh ghi: tạo đơn ghi bộ đếm mã vận đơn, `orders`, `orderDrafts` cùng thành công hoặc cùng hủy; service không `import` mongoose |
| **Hàm thuần dùng chung** | `modules/pricing/pricing.js` | Một nguồn sự thật cho công thức tính phí: seed, ước tính phí công khai và tạo đơn cùng gọi, có 10 unit test |

## SOLID

| Nguyên lý | Thể hiện trong code |
|---|---|
| **S** – Single Responsibility | Router chỉ định tuyến; Controller chỉ dịch HTTP; Service chỉ nghiệp vụ; Repository chỉ truy vấn; validator là hàm thuần (không DB, không băm mật khẩu: việc băm thuộc `UserService` qua `PasswordHasher`) |
| **O** – Open/Closed | Thêm danh mục mới = thêm repository + service con + một dòng trong `container.js`, không sửa `BaseCrudService`. Thêm phụ thuộc cache = thêm một dòng `DEPENDENT_CACHE_SCOPES` |
| **L** – Liskov Substitution | `CachedRepository` dùng thay được `BaseRepository` ở mọi chỗ (cùng giao diện); `MemoryCacheStore` thay được `RedisCacheStore` |
| **I** – Interface Segregation | Giao diện nhỏ, đúng nhu cầu: kho cache chỉ cần `get/set/incr/del`; `AuthService` chỉ cần `hash/compare` của hasher, không biết bcrypt |
| **D** – Dependency Inversion | Service phụ thuộc giao diện được tiêm vào, không `import` Redis/bcrypt/JWT trực tiếp; chỉ `container.js` biết lớp cụ thể |

## Cache hai lớp (30 giây)

| Lớp | Ở đâu | Khi nào xóa |
|---|---|---|
| API → Redis | `CacheService` (versioned namespace: xóa cả vùng bằng một lệnh `INCR`) | Ghi qua service thì xóa ngay; quá 30 giây tự hết hạn |
| App → bộ nhớ | `QueryCache` + `useCachedQuery` (web), `ResourceScreen` (App NV) | Ghi xong xóa ngay; màn hình mở thì tự làm mới mỗi 30 giây; đăng nhập/đăng xuất xóa sạch |

Không cache: đăng nhập (tài khoản vừa bị khóa phải chặn ngay), kiểm tra ràng buộc
(`exists`, `findOne`), hồ sơ `/auth/me` phía server, và dữ liệu riêng của từng người dùng (địa điểm lấy hàng,
đơn hàng, bản nháp đơn) — phí và ràng buộc phải tính trên dữ liệu mới nhất.
Header `X-Cache: HIT | MISS` trên API công khai cho biết dữ liệu đến từ đâu.

## Thêm một danh mục mới (đã làm đúng các bước này cho Hub & bưu cục, US-14)

1. `modules/hubs/hubs.validator.js`: `export const hubValidator = { create(body), update(body) }`.
2. `modules/hubs/HubService.js`: `class HubService extends BaseCrudService`, ghi đè hook nếu có ràng buộc riêng
   (bưu cục phải trực thuộc một hub, tự gắn khu vực phục vụ, chặn xóa điểm còn tuyến / nhân viên).
3. `modules/hubs/hubs.router.js`: chú thích Swagger + `buildHubsRouter()` gọi `createCrudRouter`.
4. `container.js`: tạo repository, bọc `withCache(..., "hubs")`, thêm vào `services`.
5. `app.js`: `app.use("/hubs", buildHubsRouter(container))`.
6. Test: đổi các dòng `[US-14]` trong `tests/stories-pending.test.js` thành test thật (`tests/hubs.test.js`).

## Tài nguyên theo chủ sở hữu và phạm vi theo vai trò (Sprint 3)

Danh mục dùng chung đi qua `createCrudRouter`; dữ liệu **của từng người** thì không:

| Thành phần | Cách làm |
|---|---|
| Địa điểm lấy hàng (`/pickupLocations`) | `PickupLocationController` lấy `req.user.id` từ token, mọi truy vấn kèm `customerId` — khách không chạm được địa điểm của người khác (trả 404) |
| Đơn hàng (`/orders`) | `OrderService` tính phạm vi theo vai trò: khách — đơn của mình; nhân viên kho — đơn của hub mình và các bưu cục trực thuộc; tài xế — đơn được giao; quản trị — tất cả |
| Quyền | `requirePermission` nhận một quyền hoặc **mảng quyền** (có một là đủ), ví dụ xem đơn: `order:read:own`, `order:read:hub`, `order:read:assigned` |
| Trang công khai biết người dùng | `optionalAuth`: có token hợp lệ thì gắn `req.user`, không có thì coi là khách vãng lai — bản nháp đơn (`/orderDrafts`) thuộc về khách đăng nhập mở nó |
| Ước tính phí (`POST /orders/estimate-fee`) | Công khai; `PricingService` tìm khu vực phục vụ hai đầu, bảng giá hiệu lực theo dịch vụ + vùng rồi gọi `pricing.calculate` |

## Hàng đợi sự kiện, tra cứu công khai, phân công (Sprint 4)

| Thành phần | Cách làm |
|---|---|
| Hàng đợi sự kiện (US-21) | `infrastructure/queue/BullEventQueue.js` bọc BullMQ (Adapter). `OrderService` ghi trạng thái + `statusHistory` xong mới phát `order.status.changed`; thử lại 5 lần giãn cách tăng dần, hết lượt chép sang `<tên>-dlq`. `server.js` chạy worker; test dùng hàng đợi riêng `order-events-test` |
| Consumer (Observer qua hàng đợi) | `container.orderEventHandlers`: (1) `JourneyService.project` dựng lại hành trình công khai vào Redis `journey:<mã>`; (2) `AssignmentService.onOrderStatusChanged` phân công lấy hàng khi đơn sang CONFIRMED. Cả hai idempotent vì job có thể chạy lại |
| Tra cứu công khai (US-22) | `GET /tracking/:code`, hàm thuần `orders/journey.js` (che số điện thoại, không tên/địa chỉ người nhận); `RateLimiter` đếm trên Redis (`INCR` + `EXPIRE NX`), middleware `createRateLimit` trả 429 kèm `Retry-After` |
| Tiếp nhận tại quầy (US-40) | `/orders/counter/*` (quyền `order:approve`): tìm / tạo khách lẻ, báo giá từ điểm của nhân viên, một transaction CREATED → CONFIRMED → AT_HUB; hàm thuần `orders/vehicle.js` gợi ý xe máy / xe tải |
| Ca làm việc (US-23) | `/shifts` (quyền `shift:manage`), phạm vi tuyến theo hub dùng chung `routes/routeScope.js`; tài xế xem ca mình ở `/shifts/mine` |
| Năng lực 3 cấp (US-24) | Hàm thuần `capacity/capacity.js` (`effectiveCapacity`: người → tuyến → hệ thống); mặc định hệ thống ở collection kỹ thuật `settings` (như `counters`, không tính vào 12 collection nghiệp vụ); `/capacity/system` chỉ quản trị viên (quyền `capacity:system`) |
| Phân công lấy hàng (US-25, US-27) | `AssignmentService`: ca còn mở hôm nay của tuyến lấy hàng → người ít đơn chưa lấy nhất, chưa đầy năng lực. **Khóa ca**: trong cùng transaction tăng `Shift.assignSeq` rồi mới đếm tải — hai transaction gán vào một ca xung đột ghi, `withTransaction` chạy lại bên thua. Hết chỗ: đơn giữ CONFIRMED, ghi `unassignedReason`. Điều chỉnh tay (`POST /assignments/pickup`) bắt buộc lý do, hủy phân công cũ (CANCELLED). Tài xế: `/assignments/mine/pickups` |
