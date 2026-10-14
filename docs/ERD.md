# Sơ đồ thực thể - quan hệ (ERD) — EDMS

Ứng với US-02 / Task T3 (Sprint 1). Mở file này trên GitHub (web) để xem sơ đồ
được vẽ tự động — không cần cài thêm công cụ nào.

## Sơ đồ

```mermaid
erDiagram
    ROLE ||--o{ ROLE : "inheritsFrom (tu tham chieu)"
    ROLE ||--o{ USER : "role (tham chieu mem theo ma, khong phai FK that)"

    HUB ||--o{ ROUTE : "quan ly"
    HUB ||--o{ USER : "HUB_STAFF thuoc ve (hubId)"

    ROUTE ||--o{ SERVICEAREA : "phu trach"
    ROUTE ||--o{ SHIFT : "co ca lam viec"
    ROUTE }o--o{ USER : "SHIPPER duoc gan (routeIds)"

    SHIFT }o--o{ USER : "shipperIds"

    SERVICEAREA ||--o{ PICKUPLOCATION : "xac dinh vung phuc vu"

    USER ||--o{ PICKUPLOCATION : "customerId"
    USER ||--o{ ORDER : "customerId (nguoi gui)"
    USER ||--o{ ORDER : "assignedTo (shipper dang xu ly)"
    USER ||--o{ ASSIGNMENT : "shipperId"
    USER ||--o{ ASSIGNMENT : "assignedBy (hub staff)"
    USER ||--o{ ORDERDRAFT : "customerId (co the null)"

    SERVICETYPE ||--o{ PRICETABLE : "co bang gia rieng"
    SERVICETYPE ||--o{ ORDER : "serviceTypeId"

    PICKUPLOCATION ||--o{ ORDER : "pickupLocationId"

    ORDER ||--o{ ASSIGNMENT : "orderId"

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
        ObjectId hubId FK
        ObjectId_array routeIds FK
    }
    HUB {
        ObjectId _id PK
        string code UK
        string type
        string province
        string district
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
        ObjectId routeId FK
        ObjectId_array shipperIds FK
        date shiftDate
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
    }
    PICKUPLOCATION {
        ObjectId _id PK
        ObjectId customerId FK
        ObjectId serviceAreaId FK
        boolean isDefault
    }
    ORDER {
        ObjectId _id PK
        string trackingCode UK
        ObjectId customerId FK
        ObjectId pickupLocationId FK
        ObjectId serviceTypeId FK
        ObjectId assignedTo FK
        string status
        array statusHistory "nhung"
        object fee "nhung"
        object cod "nhung"
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
        string type
        string status
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

**Tham chiếu khi**: thực thể có vòng đời độc lập, thay đổi không phụ thuộc
thực thể gọi đến nó:
- `Order.customerId`, `Order.assignedTo` → trỏ sang `User` (một user tồn tại độc lập với đơn hàng)
- `Route.hubId`, `ServiceArea.routeId` → trỏ sang `Hub`/`Route`
- `PriceTable.serviceTypeId` → trỏ sang `ServiceType`

**Denormalize có chọn lọc**: một số trường tham chiếu còn được **chép thêm**
bản sao trực tiếp vào document cha để tránh `$lookup` ở các màn hình danh sách
hay gọi — ví dụ `Order.customerName`, `Order.serviceName`, `Order.pickupWard`.
Đánh đổi: nếu tên khách hàng đổi sau này, các đơn cũ vẫn giữ tên cũ tại thời
điểm tạo đơn — đây là chủ ý, không phải lỗi (phí/thông tin đơn phải "đóng băng"
tại thời điểm xác nhận).

## Đối chiếu với code thật

Mỗi hộp trong sơ đồ tương ứng đúng một file trong
`code/apps/api/src/models/` (ví dụ hộp `ORDER` ↔ file `Order.js`). Các mũi tên
tham chiếu (`FK`) tương ứng field khai báo `ref: "TenModel"` trong từng file đó.
