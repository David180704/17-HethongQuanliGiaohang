import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";

// Kiem thu SONG SONG hai app that cung luc tren cung mot backend:
// nhan vien thao tac tren App Nhan vien (Expo web, cong 8082), khach hang
// thay ket qua ngay tren Web Khach hang (cong 5173). Can ca API (4044),
// "npm run dev" (web) va "npm run web" (apps/staff) dang chay.
const STAFF_URL = process.env.E2E_STAFF_URL || "http://localhost:8082";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
// Ca 3.321 xa/phuong deu dang phuc vu -> tam go mot xa/phuong co that (ten khong trung noi nao khac)
// de admin them lai qua app; xong tra lai dung tuyen cua tinh (lien tinh phia Bac).
const AREA = { province: "Cao Bằng", ward: "Phường Nùng Trí Cao" };
const SEARCH = "Nùng Trí Cao";

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "pipe" });
}
const removeArea = () => mongo(`db.serviceareas.deleteMany({ province: "${AREA.province}", ward: "${AREA.ward}" })`);
const restoreArea = () =>
  mongo(
    `const s = db.serviceareas.findOne({ province: "${AREA.province}", ward: { $ne: "${AREA.ward}" } });` +
      `db.serviceareas.updateOne({ province: "${AREA.province}", ward: "${AREA.ward}" }, { $set: { region: s.region, routeId: s.routeId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true })`,
  );

test.beforeAll(removeArea);
test.afterAll(restoreArea);

// Web Khach hang cache du lieu 30 giay va tu lam moi moi 30 giay (yeu cau "khong goi
// API lien tuc") -> khach thay thay doi cua admin TOI DA sau 30 giay, khong phai ngay.
test("admin them vung phuc vu tren App Nhan vien -> khach thay tren Web trong vong 30 giay", async ({ browser }) => {
  test.setTimeout(3 * 60_000);

  // Hai "thiet bi" doc lap: nhan vien (may tinh) va khach hang (dien thoai)
  const staffContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staff = await staffContext.newPage();
  const customer = await customerContext.newPage();
  staff.on("dialog", (dialog) => dialog.accept());

  // Khach mo trang vung phuc vu, tim xa/phuong chua phuc vu
  const found = customer.getByRole("region", { name: "Xã/phường tìm thấy" });
  await customer.goto("/vung-phuc-vu");
  await customer.getByLabel("Tìm vùng phục vụ").fill(SEARCH);
  await expect(found).toContainText(`Chưa phục vụ xã/phường nào khớp “${SEARCH}”`);

  // Nhan vien dang nhap App Nhan vien va them quan do
  await staff.goto(STAFF_URL);
  await staff.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin@edms.vn");
  await staff.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await staff.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await staff.getByRole("button", { name: "Khu vực phục vụ", exact: true }).click();
  await staff.getByRole("button", { name: "+ Thêm mới" }).click();
  await staff.getByLabel("Tỉnh/Thành phố", { exact: true }).fill("cao bang"); // go khong dau, luu ten chuan
  await staff.getByLabel("Xã/Phường", { exact: true }).fill("nung tri cao");
  await staff.getByRole("radio", { name: "Miền Bắc", exact: true }).click();
  await staff.getByRole("radio", { name: /R-HN-LIEN/ }).click();
  await staff.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(staff.getByText("Đã thêm mới")).toBeVisible();

  // Khach tim lai (khong dang nhap) -> thay ngay quan vua them
  await customer.getByLabel("Tìm vùng phục vụ").fill("");
  await customer.getByLabel("Tìm vùng phục vụ").fill(SEARCH);
  await expect(found).toContainText(`${AREA.ward}, ${AREA.province}`, { timeout: 40_000 });
  await staff.screenshot({ path: `${SHOT_DIR}/10-cross-app-staff.png` });
  await customer.screenshot({ path: `${SHOT_DIR}/10-cross-app-customer.png` });

  // Nhan vien xoa -> khach tim lai thi het
  await staff.getByPlaceholder("Tìm theo tỉnh, xã/phường...").fill(SEARCH);
  await staff.getByRole("button", { name: `Xóa ${AREA.ward}` }).click();
  await expect(staff.getByText(`Đã xóa "${AREA.ward}"`)).toBeVisible();
  await customer.getByLabel("Tìm vùng phục vụ").fill("");
  await customer.getByLabel("Tìm vùng phục vụ").fill(SEARCH);
  await expect(found).toContainText(`Chưa phục vụ xã/phường nào khớp “${SEARCH}”`, { timeout: 40_000 });

  await staffContext.close();
  await customerContext.close();
});
