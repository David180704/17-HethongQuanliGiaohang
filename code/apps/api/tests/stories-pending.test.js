// Story Sprint 4-7 CHUA CO CODE (ke hoach lap lai 05/11/2026, docs/PERT_ToanDuAn.docx). Moi dong la
// mot tieu chi chap nhan, lay tu Sprint Backlog (cot Notes), Product Backlog va bang doi chieu hai de
// (docs/DoiChieuCaseStudy_MoRong.md). npm test in ra "todo N" = so tieu chi con no. Lam xong story nao
// thi doi test.todo(...) thanh test that cua story do (giu nguyen nhan [US-xx]).
import { test } from "node:test";

const pending = {
  // ---------- Sprint 4 (06/11 - 01/12/2026) ----------
  "US-21": ["BullMQ topic order.status.changed, consumer ghi hanh trinh, co retry va dead-letter queue"],
  "US-22": [
    "GET /tracking/:code cong khai, gom 18 trang thai thanh 4 nhom cho khach",
    "Che so dien thoai dang 09xx xxx 123, gioi han 20 request/phut/IP",
  ],
  "US-40": [
    "Nhan vien kho tim khach theo so dien thoai hoac tao nhanh khach le tai quay",
    "Tao don ho khach bang bo tao don 4 buoc: don thuoc hub cua nhan vien, ghi nguoi tiep nhan",
    "Nhap ma don cua shop (ma tren website ban hang); goi y phuong tien theo khoi luong, kich thuoc, hang la xe",
  ],
  "US-23": ["Quan ly ca lam viec, gan nguoi giao hang vao tuyen theo tung ca"],
  "US-24": ["Nang luc toi da 3 cap uu tien: nhan vien -> tuyen -> mac dinh he thong"],
  "US-25": [
    "Tu dong phan cong don lay hang theo tuyen, chon nguoi it don nhat chua day nang luc",
    "Transaction chong vuot nang luc khi nhieu don gan cung luc; het cho -> hang cho UNASSIGNED",
    "Quan ly dieu chinh phan cong tay (nghi, doi ca, qua tai, don uu tien), bat buoc ghi ly do (PB#53)",
  ],
  "US-27": ["Danh sach don can lay loc theo nguoi giao hang va ca hien tai"],
  // ---------- Sprint 5 (02/12 - 18/12/2026) ----------
  "US-28": [
    "Xac nhan da lay hang: quet ma van don, ghi toa do GPS va thoi gian",
    "Khong lay duoc hang: bat buoc chon nguyen nhan, ghi vao hanh trinh don (PB#34)",
  ],
  "US-41": [
    "Nhap kho bang ma van don: don chuyen AT_HUB (AT_DEST_HUB neu la kho dich), ghi nhan vien va thoi gian",
    "Phan loai theo loai hang (danh sach co dinh theo de 14) va tuyen: don chuyen SORTED",
    "Xuat kho len chang sau: don chuyen IN_TRANSIT; nhan vien kho chi thao tac don cua hub minh",
  ],
  "US-29": ["Quan ly diem check-in tren ban do: toa do + ban kinh mac dinh 150m"],
  "US-30": ["Tu dong check-in khi di qua diem, chan trung 30 phut, xep hang doi khi mat mang"],
  "US-42": ["Khach khai bao tai khoan ngan hang nhan tien thu ho: ngan hang, so tai khoan, chu tai khoan (PB#12)"],
  // ---------- Sprint 6 (21/12/2026 - 11/01/2027) ----------
  "US-35": [
    "Tu dong phan cong don giao khi don den AT_DEST_HUB, cung thuat toan chieu lay hang",
    "Don gui nhanh giao rieng, duoc phan cong truoc don gui thuong (de 14)",
  ],
  "US-31": [
    "Danh sach don can giao loc theo nguoi giao hang va ca hien tai",
    "Phieu giao hang in duoc (dia chi, phuong/xa, so dien thoai) co ma QR chua ma van don (PB#18, de 14)",
  ],
  "US-32": [
    "Xac nhan giao thanh cong: ghi GPS, chuyen DELIVERED, khong doi trang thai duoc nua",
    "Giao that bai: bat buoc chon nguyen nhan, tang so lan giao (PB#40)",
  ],
  "US-33": ["Ghi nhan thu COD tien mat hoac chuyen khoan, cung transaction voi chuyen DELIVERED"],
  "US-36": ["Chinh sach giao lai: mac dinh toi da 3 lan giao, vuot qua thi don chuyen RETURNING"],
  "US-37": ["Hoan hang: phan cong theo tuyen (Assignment.type = RETURN), ket thuc RETURNED khi shop xac nhan"],
  // ---------- Sprint 7 (12/01 - 02/02/2027) ----------
  "US-44": [
    "Gui nhanh bat buoc nguoi gui tra truoc bang chuyen khoan; ma QR dong theo chuan VietQR dung so tien va noi dung",
    "Nhan vien xac nhan da nhan tien: don ghi feePaid va feePaidAt",
  ],
  "US-34": ["Tao ky doi soat trong transaction, moi don chi thuoc dung mot ky, netPayable dung cong thuc"],
  "US-43": [
    "Shop xem ky doi soat, chi tiet tung don va khoan dieu chinh (PB#21, #75, #76)",
    "Ghi nhan da chi tra vao tai khoan ngan hang da khai bao, ky doi soat chuyen hoan tat",
  ],
  "US-38": ["Ghi nhan su co/khieu nai o moi thoi diem trong vong doi don, don chuyen INCIDENT, theo doi xu ly va ket qua"],
  "US-39": ["Thong ke don theo trang thai, shop, tuyen, nang suat nhan vien, doanh thu, thu ho bang aggregation pipeline"],
};

for (const [story, criteria] of Object.entries(pending)) {
  for (const criterion of criteria) test.todo(`[${story}] ${criterion}`);
}
