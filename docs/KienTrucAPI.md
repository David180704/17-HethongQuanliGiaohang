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
(`exists`, `findOne`), và hồ sơ `/auth/me` phía server.
Header `X-Cache: HIT | MISS` trên API công khai cho biết dữ liệu đến từ đâu.

## Thêm một danh mục mới (ví dụ: Hub, story US-14)

1. `modules/hubs/hubs.validator.js`: `export const hubValidator = { create(body), update(body) }`.
2. `modules/hubs/HubService.js`: `class HubService extends BaseCrudService`, ghi đè hook nếu có ràng buộc riêng.
3. `modules/hubs/hubs.router.js`: chú thích Swagger + `buildHubsRouter()` gọi `createCrudRouter`.
4. `container.js`: tạo repository, bọc `withCache(..., "hubs")`, thêm vào `services`.
5. `app.js`: `app.use("/hubs", buildHubsRouter(container))`.
6. Test: đổi các dòng `[US-14]` trong `tests/stories-pending.test.js` thành test thật.
