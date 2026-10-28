# Làm chủ dữ liệu và kiểm thử EDMS

Tài liệu này dành cho người **tự quản lý dữ liệu và tự viết test**, kể cả khi không trực tiếp
viết code ứng dụng. Chạy từng phần xem `HuongDanChayThu.md`. Đưa dữ liệu lên cloud xem
`HuongDanMongoAtlas.md`.

## 1. Dữ liệu nằm ở đâu

```
                       ┌──────── Redis (cache 30 giây, phiên đăng nhập, khóa sai mật khẩu)
App ──► API (4044) ────┤
                       └──────── MongoDB: local (Docker) để test · Atlas (cloud) để chạy thật
```

12 collection chính. Mô hình chi tiết ở `docs/ERD.md`, ràng buộc ở `docs/RangBuocToanVen.md`.

| Collection | Chứa gì | Ai sửa |
|---|---|---|
| `users`, `roles` | Tài khoản, vai trò, quyền (CUSTOMER kế thừa GUEST) | Admin (App Nhân viên), đăng ký (Web) |
| `routes`, `serviceareas`, `hubs` | Tuyến, quận/huyện phục vụ, điểm tập kết | Admin |
| `servicetypes`, `pricetables` | Gửi thường/nhanh, bảng giá theo vùng và khối lượng | Admin |
| `orders`, `orderdrafts`, `assignments`, `pickuplocations`, `shifts` | Đơn hàng, nháp, phân công, địa điểm lấy hàng, ca | Sprint 3–5 (chưa có giao diện) |

**Xem dữ liệu:**
- Local: cài [MongoDB Compass](https://www.mongodb.com/products/compass), kết nối
  `mongodb://localhost:27017/?directConnection=true`, mở database `edms`.
- Cloud: Atlas → **Data Explorer**, hoặc Compass dán chuỗi `mongodb+srv://...`.

## 2. Việc dữ liệu hay làm

| Muốn | Làm |
|---|---|
| Đưa dữ liệu về trạng thái ban đầu (local) | `cd code/apps/api` → `npm run seed:local` |
| Nối API với Atlas (cloud) | `npm run atlas:setup`, dán chuỗi kết nối (thử kết nối thật rồi mới ghi `.env`) |
| Đưa dữ liệu mẫu lên cloud | `npm run seed -- --yes` (**xóa sạch** dữ liệu cloud cũ) |
| Thêm / đổi tài khoản test | Sửa `code/apps/api/src/seed/testAccounts.js` rồi seed lại |
| Đổi danh mục mẫu (tuyến, quận, bảng giá) | Sửa `code/apps/api/src/seed/referenceData.js` rồi seed lại |
| Gỡ khóa tài khoản sai mật khẩu 5 lần | `docker exec edms-redis redis-cli DEL login:lock:<email> login:fail:<email>` |
| Xóa toàn bộ cache | `docker exec edms-redis sh -c "redis-cli --scan --pattern 'cache:*' \| xargs -r redis-cli DEL"` (cache tự dựng lại). **Không dùng `FLUSHDB`**: lệnh đó xóa luôn danh sách token đã thu hồi, người đã đăng xuất dùng lại được token cũ |
| Sao lưu | `mongodump --uri "<chuỗi kết nối>" --out backup-<ngày>` |
| Tắt cache khi cần soi dữ liệu thật | Đặt `CACHE_TTL_SECONDS=0` trong `.env` rồi khởi động lại API |

**Quy tắc vàng:**
1. Test **chỉ** chạy trên CSDL local, không bao giờ chạy trên Atlas.
2. Dữ liệu test tự tạo phải có email/tên riêng (vd `story-admin@edms.vn`, `Tỉnh E2E`) và
   **tự dọn** sau khi chạy. Lần chạy bị ngắt giữa chừng thì lần sau tự dọn phần còn sót
   (`tests/helpers/fixtures.js`).
3. Đổi dữ liệu mẫu thì sửa file seed, không sửa tay trong CSDL. Sửa tay sẽ mất ở lần seed sau.

## 3. Các tầng kiểm thử của dự án

| Tầng | Công cụ | Nằm ở | Chạy |
|---|---|---|---|
| Unit | `node:test` | `apps/api/tests/cache.test.js` (phần đầu) | `npm test` |
| API (tích hợp) | `node:test` + Supertest | `apps/api/tests/*.test.js` | `npm test`, `npm run test:story -- N` |
| Web | Playwright | `apps/web/tests-e2e/` | `npm run test:e2e` |
| App Nhân viên (trình duyệt) | Playwright | `apps/staff/tests-e2e/` | `npm run test:e2e` |
| App Nhân viên (máy ảo Android) | Maestro | `apps/staff/.maestro/` | `code/test-mobile.ps1` |
| Liên thiết bị | Playwright + Maestro | `apps/web/tests-e2e/mobile-cross.spec.js` | `code/test-song-song.ps1` |

Mỗi test API mang nhãn story trong tên, ví dụ `[US-06] ...`. `npm run report:stories` gom
kết quả theo nhãn và cập nhật `docs/KiemThuTheoStory.md`.

## 4. Tự viết test API cho một story

Mở `apps/api/tests/stories-pending.test.js`, tìm tiêu chí cần làm, ví dụ
`[US-19] Chan luu khi DEDUCT_FROM_COD ma tien thu ho nho hon phi`. Khi code xong, xóa dòng
`test.todo` đó và viết test thật vào một file mới:

```js
// apps/api/tests/us19-cod.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { getRedis } from "../src/config/redis.js";

let app;
before(async () => {
  await mongoose.connect("mongodb://localhost:27017/edms?directConnection=true");
  app = createApp();
});
after(async () => {
  await getRedis().quit();          // thiếu dòng này thì test treo không kết thúc
  await mongoose.disconnect();
});

test("[US-19] Chan luu khi DEDUCT_FROM_COD ma tien thu ho nho hon phi", async () => {
  const res = await request(app).post("/orders").send({ /* ... */ });
  assert.equal(res.status, 400);                       // mong đợi bị chặn
  assert.equal(res.body.error.code, "VALIDATION_ERROR");
});
```

Chạy riêng story đó: `npm run test:story -- 19`.

**Viết test tốt:**
- Một test kiểm **một** tiêu chí; tên test chính là tiêu chí.
- Kiểm cả trường hợp **sai**: thiếu dữ liệu, sai quyền, vượt giới hạn (vd COD > 20 triệu).
- So sánh `error.code` (ổn định), không so cả câu thông báo (dễ đổi chữ).
- Viết test **trước** khi làm giao diện (quy định trong CLAUDE.md).

## 5. Tự tạo test giao diện mà không cần viết code từ đầu

**Web (Playwright codegen)**: mở trình duyệt, bạn bấm đến đâu, công cụ ghi thành code đến đó:

```powershell
cd code/apps/web
npx playwright codegen http://localhost:5173
```

Copy đoạn code sinh ra vào một file `tests-e2e/<ten>.spec.js`, thêm `expect(...)` cho điều
cần kiểm, rồi chạy `npx playwright test <ten>`.

**Máy ảo Android (Maestro Studio)**: bấm vào phần tử trên màn hình máy ảo để lấy lệnh:

```powershell
cd code/apps/staff
maestro studio
```

Flow Maestro là file YAML dễ đọc, ví dụ:

```yaml
appId: host.exp.exponent
---
- runFlow:
    file: subflows/login-ok.yaml
    env:
      USER_EMAIL: admin@edms.vn
- tapOn: "Tuyến"
- assertVisible: "Nội thành Hà Nội"
```

Lưu ở `apps/staff/.maestro/08-<ten>.yaml`, chạy bằng
`code\test-mobile.ps1 -Flow 08-<ten>`. Lưu ý: lệnh `inputText` của Maestro **không gõ
được chữ có dấu** trên Android, nên dữ liệu nhập từ máy ảo dùng chữ không dấu.

## 6. Đọc kết quả và khi test fail

1. Đọc **tên test** để biết tiêu chí nào sai, rồi đọc dòng `expected` / `actual`.
2. Chạy lại riêng test đó: `npm run test:story -- N`, hoặc `npx playwright test -g "<tên>"`.
3. Test giao diện fail thì mở ảnh chụp lúc lỗi: `test-results/` (Playwright),
   `apps/staff/maestro-report/chi-tiet/` (Maestro).
4. Pass khi chạy riêng nhưng fail khi chạy chung: thường do hai test đụng cùng một dữ liệu.
   Cho mỗi test dùng dữ liệu riêng (email/tên có tiền tố riêng).
