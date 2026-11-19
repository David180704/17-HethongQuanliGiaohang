// Story Sprint 4-7 CHUA CO CODE (ke hoach lap lai 05/11/2026, docs/PERT_ToanDuAn.docx). Moi dong la
// mot tieu chi chap nhan, lay tu Sprint Backlog (cot Notes), Product Backlog va bang doi chieu hai de
// (docs/DoiChieuCaseStudy_MoRong.md). npm test in ra "todo N" = so tieu chi con no. Lam xong story nao
// thi doi test.todo(...) thanh test that cua story do (giu nguyen nhan [US-xx]).
import { test } from "node:test";

const pending = {
  // ---------- Sprint 4, 5, 6: da xong het ----------
  // ---------- Sprint 7 (12/01 - 02/02/2027) ----------
  // US-34, US-43, US-38, US-39 xong 12/11/2026; US-44 (VNPay) xong 19/11/2026.
  // Them 19/11/2026 theo yeu cau cua Product Owner: he thong chay that tren may chu, hai nen tang (web, di dong)
  // cho ca nhan vien lan khach hang, cai duoc tren dien thoai that.
  "US-45": [
    "API chay tren may chu cong khai (HTTPS), du lieu tren MongoDB Atlas, Redis tren may chu; /health khong lo dia chi CSDL",
    "Bien moi truong bat buoc khi chay that: khong dung secret mac dinh, CORS chi mo cho dia chi web cua he thong",
    "VNPay goi IPN ve dia chi cong khai cua API; giao dich sandbox thanh cong ghi don da tra phi",
  ],
  "US-46": [
    "Web Nhan vien co dia chi rieng: admin, nhan vien kho, tai xe dang nhap va dung du chuc nang nhu App Nhan vien",
    "Web Khach hang co dia chi rieng; tai khoan nhan vien bi tu choi o web khach va nguoc lai",
  ],
  "US-47": [
    "App Khach hang va App Nhan vien cai duoc tren dien thoai Android that, ket noi API tren may chu",
    "Ban phat hanh co ten goi, phien ban, chinh sach quyen rieng tu; tai len kenh thu nghiem noi bo CH Play",
  ],
};

for (const [story, criteria] of Object.entries(pending)) {
  for (const criterion of criteria) test.todo(`[${story}] ${criterion}`);
}
