// Story Sprint 4-7 CHUA CO CODE (ke hoach lap lai 05/11/2026, docs/PERT_ToanDuAn.docx). Moi dong la
// mot tieu chi chap nhan, lay tu Sprint Backlog (cot Notes), Product Backlog va bang doi chieu hai de
// (docs/DoiChieuCaseStudy_MoRong.md). npm test in ra "todo N" = so tieu chi con no. Lam xong story nao
// thi doi test.todo(...) thanh test that cua story do (giu nguyen nhan [US-xx]).
import { test } from "node:test";

const pending = {
  // ---------- Sprint 4 (06/11 - 01/12/2026): da xong het ----------
  // ---------- Sprint 5 (02/12 - 18/12/2026): da xong het ----------
  // ---------- Sprint 6 (21/12/2026 - 11/01/2027): da xong het (lam som 12/11/2026) ----------
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
