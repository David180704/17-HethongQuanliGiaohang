# Sơ đồ thực thể - quan hệ (ERD) — EDMS

Ứng với US-02 / Task T3 (Sprint 1), cập nhật theo Sprint 3 (05/11/2026): cấp bậc hub – bưu cục,
khu vực phục vụ của điểm, hub duyệt đơn, bảng giá đã dùng và thời điểm khóa phí. Mở file này trên
GitHub (web) để xem sơ đồ được vẽ tự động — không cần cài thêm công cụ nào.

## Sơ đồ

```mermaid
erDiagram
    ROLE ||--o{ ROLE : "inheritsFrom (tu tham chieu)"
    ROLE ||--o{ USER : "role (tham chieu mem theo ma, khong phai FK that)"

    HUB ||--o{ HUB : "parentHubId (buu cuc truc thuoc hub)"
    HUB ||--o{ ROUTE : "quan ly"
    HUB ||--o{ USER : "HUB_STAFF thuoc ve (hubId)"
    HUB ||--o{ ORDER : "pickupHubId (diem duyet don)"

    ROUTE ||--o{ SERVICEAREA : "phu trach"
    ROUTE ||--o{ SHIFT : "co ca lam viec"
    ROUTE }o--o{ USER : "SHIPPER duoc gan (routeIds)"

    SHIFT }o--o{ USER : "shipperIds"

    SERVICEAREA ||--o{ PICKUPLOCATION : "xac dinh vung phuc vu"
    SERVICEAREA ||--o{ HUB : "serviceAreaId (khu vuc dat diem)"

    USER ||--o{ PICKUPLOCATION : "customerId"
    USER ||--o{ ORDER : "customerId (nguoi gui)"
    USER ||--o{ ORDER : "assignedTo (shipper dang xu ly)"
    USER ||--o{ ASSIGNMENT : "shipperId"
    USER ||--o{ ASSIGNMENT : "assignedBy (hub staff)"
    USER ||--o{ ORDERDRAFT : "customerId (co the null)"

    SERVICETYPE ||--o{ PRICETABLE : "co bang gia rieng"
    SERVICETYPE ||--o{ ORDER : "serviceTypeId"
    PRICETABLE ||--o{ ORDER : "priceTableId (bang gia da dung)"

    PICKUPLOCATION ||--o{ ORDER : "pickupLocationId"

    ORDER ||--o{ ASSIGNMENT : "orderId"
    SHIFT ||--o{ ASSIGNMENT : "shiftId"
    CHECKINPOINT ||--o{ CHECKINLOG : "pointId"
    ORDER ||--o{ CHECKINLOG : "orderId"
    USER ||--o{ CHECKINLOG : "shipperId"
    HUB |o--o{ CHECKINPOINT : "hubId"

    ROLE {
        string code PK
        string name
        string_array permissions
        string inheritsFrom FK
    }
    USER {
        ObjectId _id PK
        string email UK
        string phone UK
        string passwordHash
        string role FK
        string status
        string shopName "ten shop - dung lam customerName"
        ObjectId hubId FK
        ObjectId_array routeIds FK
    }
    HUB {
        ObjectId _id PK
        string code UK
        string type "HUB hoac POST_OFFICE"
        ObjectId parentHubId FK "bat buoc voi POST_OFFICE"
        string province
        string district
        ObjectId serviceAreaId FK "tu xac dinh"
        boolean isActive
    }
    ROUTE {
        ObjectId _id PK
        string code UK
        ObjectId hubId FK
        number maxPickupPerShift
        number maxDeliveryPerShift
    }
    SERVICEAREA {
        ObjectId _id PK
        string province
        string district
        string region
        ObjectId routeId FK
    }
    SHIFT {
        ObjectId _id PK
        string code UK "tuyen-ngay-gio bat dau"
        ObjectId routeId FK
        ObjectId_array shipperIds FK
        date shiftDate
        string startTime "HH:mm"
        string endTime "HH:mm"
        number assignSeq "khoa phan cong"
    }
    SERVICETYPE {
        ObjectId _id PK
        string code UK
        number surchargeRate
    }
    PRICETABLE {
        ObjectId _id PK
        ObjectId serviceTypeId FK
        string zone
        array weightTiers "nhung - khong vuot 20 phan tu"
        date effectiveFrom
        date effectiveTo "null = con hieu luc"
    }
    PICKUPLOCATION {
        ObjectId _id PK
        ObjectId customerId FK
        ObjectId serviceAreaId FK
        boolean isDefault "dung mot dia diem mac dinh"
        boolean isActive "xoa mem"
    }
    ORDER {
        ObjectId _id PK
        string trackingCode UK
        ObjectId customerId FK
        ObjectId pickupLocationId FK
        ObjectId pickupHubId FK
        ObjectId serviceTypeId FK
        ObjectId priceTableId FK
        ObjectId assignedTo FK
        ObjectId receivedBy FK "nhan vien tiep nhan tai quay"
        string channel "ONLINE hoac COUNTER"
        string shopOrderCode "ma don cua shop"
        string vehicle "MOTORBIKE hoac TRUCK"
        string status
        array statusHistory "nhung"
        object fee "nhung - lockedAt khi CONFIRMED"
        object cod "nhung"
        string unassignedReason "hang cho phan cong"
        ObjectId destHubId FK "kho dich"
        ObjectId currentHubId FK "kho dang giu"
        string itemCategory "loai hang khi phan loai"
    }
    CHECKINPOINT {
        ObjectId _id PK
        string code UK
        number lat
        number lng
        number radiusM "mac dinh 150"
        ObjectId hubId FK
    }
    CHECKINLOG {
        ObjectId _id PK
        ObjectId pointId FK
        ObjectId orderId FK
        ObjectId shipperId FK
        date at "thoi diem goc"
        string source "AUTO hoac MANUAL"
        string clientEventId "chong ghi trung khi gui lai"
    }
    ORDERDRAFT {
        ObjectId _id PK
        string draftToken UK
        ObjectId customerId FK "co the null"
        date createdAt "TTL 24h"
    }
    ASSIGNMENT {
        ObjectId _id PK
        ObjectId orderId FK
        ObjectId shipperId FK
        ObjectId assignedBy FK
        ObjectId shiftId FK "ca tinh vao nang luc"
        string type
        string status "ASSIGNED DONE FAILED CANCELLED"
        string method "AUTO hoac MANUAL"
        string reason "bat buoc khi MANUAL"
        date doneAt "ket qua lay hang"
        string failReason "nguyen nhan khong lay duoc"
    }
```

## Quy tắc nhúng hay tham chiếu (giải thích thiết kế)

Hai lựa chọn khi một dữ liệu "thuộc về" dữ liệu khác: **nhúng** (embed — lưu
lồng bên trong document cha) hoặc **tham chiếu** (reference — lưu ObjectId trỏ
sang collection khác, giống khóa ngoại nhưng không ép buộc toàn vẹn như SQL).

**Nhúng khi**: dữ liệu luôn được đọc kèm theo "cha" và không vượt quá ~20 phần
tử — tránh phải truy vấn thêm (`$lookup`) mỗi lần đọc danh sách:
- `Order.statusHistory` — lịch sử trạng thái của một đơn, luôn hiển thị kèm chi tiết đơn
- `Order.fee`, `Order.cod`, `Order.receiver`, `Order.item` — thuộc tính riêng của đơn, không có lý do tồn tại độc lập
- `PriceTable.weightTiers` — các bậc khối lượng của một bảng giá
- `Order.fee.lockedAt` — thời điểm đơn chuyển CONFIRMED; từ đó phí cố định, đổi bảng giá về sau
  không làm đổi phí đơn này (US-17)

**Tham chiếu khi**: thực thể có vòng đời độc lập, thay đổi không phụ thuộc
thực thể gọi đến nó:
- `Order.customerId`, `Order.assignedTo` → trỏ sang `User` (một user tồn tại độc lập với đơn hàng)
- `Route.hubId`, `ServiceArea.routeId` → trỏ sang `Hub`/`Route`
- `PriceTable.serviceTypeId` → trỏ sang `ServiceType`
- `Hub.parentHubId` (tự tham chiếu) — bưu cục (`POST_OFFICE`, cấp quận/huyện) trực thuộc một `HUB`
  (điểm tập kết cấp tỉnh/vùng); HUB không có cấp trên. `Hub.serviceAreaId` do `HubService` tự xác
  định từ tỉnh + quận của điểm (US-14)
- `Order.pickupHubId` — điểm quản lý tuyến của khu vực lấy hàng, xác định lúc tạo đơn: nhân viên kho
  điểm này (hoặc hub cấp trên) duyệt đơn (US-18)
- `Order.priceTableId` — bảng giá đã dùng để tính phí; một bảng giá "đã dùng" thì không sửa được nữa

**Denormalize có chọn lọc**: một số trường tham chiếu còn được **chép thêm**
bản sao trực tiếp vào document cha để tránh `$lookup` ở các màn hình danh sách
hay gọi — ví dụ `Order.customerName`, `Order.serviceName`, `Order.pickupWard`.
Đánh đổi: nếu tên khách hàng đổi sau này, các đơn cũ vẫn giữ tên cũ tại thời
điểm tạo đơn — đây là chủ ý, không phải lỗi (phí/thông tin đơn phải "đóng băng"
tại thời điểm xác nhận).

## Collection kỹ thuật (không thuộc 12 collection nghiệp vụ)

`counters` (`models/Counter.js`): `{ _id: "trackingCode", seq }` — bộ đếm tăng dần để sinh mã vận đơn
`EXP` + 10 chữ số. Lệnh `$inc` chạy **trong cùng transaction** với lệnh thêm đơn và xóa bản nháp, nên
hai đơn tạo đồng thời không bao giờ trùng mã, còn transaction bị hủy thì không tốn số. Seed đặt
`seq = 1000000199` (200 đơn mẫu); thiếu bộ đếm thì bắt đầu sau mã lớn nhất đang có. Collection này cố
ý không export qua `models/index.js` nên không có trong sơ đồ và file cấu trúc mongosh.

`settings` (`models/Setting.js`, Sprint 4): `{ _id: "capacity", maxPickupPerShift, maxDeliveryPerShift,
updatedBy }` — năng lực mặc định hệ thống, cấp thấp nhất của năng lực 3 cấp (người giao hàng → tuyến →
hệ thống, US-24). Chỉ quản trị viên đổi; chưa có bản ghi thì dùng 20 lấy / 30 giao mỗi ca. Cũng không
export qua `models/index.js`.

## Đối chiếu với code thật

Mỗi hộp trong sơ đồ tương ứng đúng một file trong
`code/apps/api/src/models/` (ví dụ hộp `ORDER` ↔ file `Order.js`). Các mũi tên
tham chiếu (`FK`) tương ứng field khai báo `ref: "TenModel"` trong từng file đó.
File cấu trúc `code/database/*.mongodb.js` sinh từ các model bằng `npm run db:export`; test
`mongoshExport` báo lỗi nếu file này lệch với model.

Trường `Order.settlementId` đã khai báo sẵn cho đối soát thu hộ; collection đối soát và quan hệ của nó
được thêm vào sơ đồ khi làm story đối soát (Sprint 7, kế hoạch 05/11/2026).
