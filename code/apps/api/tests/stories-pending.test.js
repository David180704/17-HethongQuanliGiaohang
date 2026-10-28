// Story Sprint 3-5 CHUA CO CODE (tinh den 28/10/2026). Moi dong la mot tieu chi
// chap nhan, lay tu Sprint Backlog (cot Notes), Sprint Planning 3 va CLAUDE.md muc 5.
// npm test in ra "todo N" = so tieu chi con no. Lam xong story nao thi doi
// test.todo(...) thanh test that cua story do (giu nguyen nhan [US-xx]).
import { test } from "node:test";

const pending = {
  // ---------- Sprint 3 ----------
  "US-13": [
    "CRUD bang gia theo loai dich vu x 4 zone, bac khoi luong nhung trong bang gia",
    "Cac bac khoi luong khong chong lan va khong ho khoang trong (8 unit test ranh gioi bac)",
    "Hai bang gia cung dich vu + zone khong trung khoang hieu luc",
    "Bang gia da dung cho don hang khong xoa duoc, chi lui effectiveTo",
  ],
  "US-14": ["CRUD diem tap ket va buu cuc, moi diem gan voi mot khu vuc phuc vu"],
  "US-15": [
    "Khach quan ly dia diem lay hang, toi da 10 dia diem",
    "Tu xac dinh khu vuc phuc vu tu quan/huyen, chan dia diem ngoai vung phuc vu",
    "Chan xoa dia diem con don chua hoan tat",
  ],
  "US-16": [
    "POST /orders/estimate-fee cong khai (khong can dang nhap)",
    "orderDrafts TTL 24 gio + draftToken giu du lieu da nhap qua buoc dang ky",
  ],
  "US-17": [
    "pricingService.calculate(): khoi luong quy doi, tra 4 zone, phu phi dich vu va hang dac biet (10 unit test)",
    "Khoa phi vao don khi CONFIRMED - bang gia doi ve sau khong lam doi phi don cu",
  ],
  "US-18": [
    "Tao don trong transaction (orders + orderDrafts + counter)",
    "Ma van don EXP + 10 chu so sinh bang counter tang dan trong cung transaction",
    "Chi nhan don khi ca noi gui va noi nhan thuoc vung phuc vu",
  ],
  "US-19": [
    "3 hinh thuc tra phi: SHOP_PREPAID (QR/tien mat), RECIPIENT_PAID, DEDUCT_FROM_COD",
    "COD > 0 khi bat, toi da 20.000.000 dong",
    "Chan luu khi DEDUCT_FROM_COD ma tien thu ho nho hon phi",
  ],
  // ---------- Sprint 4 ----------
  "US-20": ["Xem chi tiet don kem toan bo hanh trinh (statusHistory nhung trong don)"],
  "US-21": ["BullMQ topic order.status.changed, consumer ghi hanh trinh, co retry va dead-letter queue"],
  "US-22": [
    "GET /tracking/:code cong khai, gom 18 trang thai thanh 4 nhom cho khach",
    "Che so dien thoai dang 09xx xxx 123, gioi han 20 request/phut/IP",
  ],
  "US-23": ["Quan ly ca lam viec, gan nguoi giao hang vao tuyen theo tung ca"],
  "US-24": ["Nang luc toi da 3 cap uu tien: nhan vien -> tuyen -> mac dinh he thong"],
  "US-25": [
    "Tu dong phan cong don lay hang theo tuyen, chon nguoi it don nhat chua day nang luc",
    "Transaction chong vuot nang luc khi nhieu don gan cung luc; het cho -> hang cho UNASSIGNED",
  ],
  "US-27": ["Danh sach don can lay loc theo nguoi giao hang va ca hien tai"],
  // ---------- Sprint 5 (dang chay: 26/10 - 06/11/2026) ----------
  "US-28": ["Xac nhan da lay hang: quet ma van don, ghi toa do GPS va thoi gian"],
  "US-29": ["Quan ly diem check-in tren ban do: toa do + ban kinh mac dinh 150m"],
  "US-30": ["Tu dong check-in khi di qua diem, chan trung 30 phut, xep hang doi khi mat mang"],
  "US-31": ["Danh sach don can giao loc theo nguoi giao hang va ca hien tai"],
  "US-32": ["Xac nhan giao thanh cong: ghi GPS, chuyen DELIVERED, khong doi trang thai duoc nua"],
  "US-33": ["Ghi nhan thu COD tien mat hoac chuyen khoan, cung transaction voi chuyen DELIVERED"],
  "US-34": ["Tao ky doi soat trong transaction, moi don chi thuoc dung mot ky, netPayable dung cong thuc"],
};

for (const [story, criteria] of Object.entries(pending)) {
  for (const criterion of criteria) test.todo(`[${story}] ${criterion}`);
}
