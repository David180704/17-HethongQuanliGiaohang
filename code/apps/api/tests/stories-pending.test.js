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
  // US-34, US-43, US-38, US-39 (de 02) da xong 12/11/2026; con US-44 (VietQR, de 14)
};

for (const [story, criteria] of Object.entries(pending)) {
  for (const criterion of criteria) test.todo(`[${story}] ${criterion}`);
}
