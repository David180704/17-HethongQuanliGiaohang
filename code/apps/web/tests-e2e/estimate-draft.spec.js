import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-16 tren Web Khach hang: khach vang lai uoc tinh phi -> "Gui hang" -> dang ky tai
// khoan MOI -> man hinh tao don con nguyen du lieu da nhap (nhap giu qua draftToken).
const SHOT_DIR = "tests-e2e/screenshots";
const PASSWORD = "Test@12345";

// API khong co chuc nang xoa tai khoan (US-10) nen xoa tai khoan do test dang ky tao
// thang trong CSDL local qua mongosh cua container (giong flow Maestro dang ky).
// globalSetup e2e-guard da dung test neu API dang dung Atlas.
function removeRegisteredUsers() {
  const script =
    "const ids = db.users.find({ email: /^e2e-draft\\d+@edms\\.vn$/ }).toArray().map((u) => u._id);" +
    "db.orderdrafts.deleteMany({ customerId: { $in: ids } }); db.users.deleteMany({ _id: { $in: ids } }).deletedCount";
  try {
    execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
  } catch {
    // may khong co Docker -> bo qua don dep
  }
}

test.afterAll(removeRegisteredUsers);

test("[US-16] khach vang lai uoc tinh phi -> Gui hang -> dang ky moi -> man hinh tao don con nguyen du lieu", async ({ page }) => {
  test.setTimeout(60_000);
  const stamp = Date.now().toString().slice(-8);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Điều hướng chính", exact: true }).getByRole("link", { name: "Ước tính phí" }).click();
  await expect(page.getByRole("heading", { name: "Ước tính phí vận chuyển" })).toBeVisible();

  const from = page.getByRole("group", { name: "Gửi từ" });
  const to = page.getByRole("group", { name: "Gửi đến" });
  await from.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  await from.getByLabel("Quận/Huyện").fill("Cầu Giấy");
  await to.getByLabel("Tỉnh/Thành phố").fill("TP Hồ Chí Minh");
  await to.getByLabel("Quận/Huyện").fill("Quận 1");
  await page.getByLabel("Khối lượng (g)").fill("1000");
  await page.getByLabel("Dài (cm)").fill("40");
  await page.getByLabel("Rộng (cm)").fill("30");
  await page.getByLabel("Cao (cm)").fill("20");
  await page.getByRole("button", { name: "Tính phí" }).click();

  // 40x30x20 cm quy doi 4,8 kg; lien mien bac 2-5 kg: 80.000 + 5 buoc x 7.000
  await expect(page.getByText("tuyến liên miền · tính theo 4.800 g (khối lượng quy đổi theo kích thước)")).toBeVisible();
  const standard = page.getByRole("article", { name: "Giao hàng tiêu chuẩn" });
  const express = page.getByRole("article", { name: "Giao hàng nhanh" });
  await expect(standard.getByText("115.000 ₫").first()).toBeVisible();
  await expect(express.getByText("155.000 ₫").first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-estimate-fee.png`, fullPage: true });

  await standard.getByRole("button", { name: "Gửi hàng gói Giao hàng tiêu chuẩn" }).click();
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftao-don%3Fdraft%3D/);
  await expect(page.getByText("Đăng nhập để tạo đơn và thanh toán.")).toBeVisible();

  await page.getByRole("link", { name: "Đăng ký" }).last().click();
  await expect(page).toHaveURL(/\/dang-ky\?next=%2Ftao-don%3Fdraft%3D/);
  await page.getByLabel("Họ tên").fill("Khách Ước Tính");
  await page.getByLabel("Email").fill(`e2e-draft${stamp}@edms.vn`);
  await page.getByLabel("Số điện thoại").fill(`09${stamp}`);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

  await expect(page).toHaveURL(/\/tao-don\?draft=/);
  const kept = page.getByRole("region", { name: "Thông tin đã nhập khi ước tính phí" });
  await expect(kept).toContainText("Gửi từ Cầu Giấy, Hà Nội → Quận 1, TP Hồ Chí Minh");
  await expect(kept).toContainText("1000 g · 40×30×20 cm · Giao hàng tiêu chuẩn");
  await page.screenshot({ path: `${SHOT_DIR}/12-draft-after-register.png`, fullPage: true });
});
