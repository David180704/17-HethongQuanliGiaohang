// Story Sprint 4-7 CHUA CO CODE (ke hoach lap lai 05/11/2026, docs/PERT_ToanDuAn.docx). Moi dong la
// mot tieu chi chap nhan, lay tu Sprint Backlog (cot Notes), Product Backlog va bang doi chieu hai de
// (docs/DoiChieuCaseStudy_MoRong.md). npm test in ra "todo N" = so tieu chi con no. Lam xong story nao
// thi doi test.todo(...) thanh test that cua story do (giu nguyen nhan [US-xx]).
import { test } from "node:test";

const pending = {
  // ---------- Sprint 4, 5, 6: da xong het ----------
  // ---------- Sprint 7 (12/01 - 02/02/2027) ----------
  // US-34, US-43, US-38, US-39 xong 12/11/2026; US-44 (VNPay) xong 19/11/2026.
  // US-45 -> US-47 them 19/11/2026 theo yeu cau Product Owner. Cau hinh trien khai, kiem cau hinh chay that, hai nen
  // tang cho moi vai tro da co test (deploy.test.js, platforms.test.js). Con lai cac tieu chi chi kiem duoc SAU KHI
  // nguoi dung tao tai khoan Render, VNPay sandbox, Expo, Google Play (docs/HuongDanTrienKhai.md):
  "US-45": [
    "API chay tren Render (HTTPS) voi CSDL MongoDB Atlas: /health tra ve ok, dang nhap duoc bang tai khoan mau",
    "VNPay sandbox goi IPN ve dia chi cong khai cua API; thanh toan bang the test NCB ghi don da tra phi",
  ],
  "US-46": ["Web Khach hang va Web Nhan vien mo duoc tu Internet tai dia chi rieng, goi API tren Render"],
  "US-47": [
    "Cai APK (EAS preview) len dien thoai Android that: dang nhap, tao don, thanh toan VNPay quay ve app",
    "Ban AAB (EAS production) tai len kenh thu nghiem noi bo CH Play, nguoi thu cai duoc tu CH Play",
  ],
};

for (const [story, criteria] of Object.entries(pending)) {
  for (const criterion of criteria) test.todo(`[${story}] ${criterion}`);
}
