import { test, expect } from "@playwright/test";

// Hai nhom nguoi gui (23/11/2026): khach le gui hang khong kem thu ho, khong co doi soat, khong khai tai khoan nhan
// COD; shop doi tac co du. Chi xem giao dien, khong tao du lieu: khach1 (ca nhan), shop2 (doanh nghiep da duyet).
const PASSWORD = "123456";

async function login(page, email, next = "/tao-don") {
  await page.goto(`/dang-nhap?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email hoặc số điện thoại").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function toParcelStep(page) {
  await expect(page.getByRole("heading", { name: "Tạo đơn hàng" })).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Tên người nhận").fill("E2E Người Nhận");
  await page.getByLabel("Số điện thoại người nhận").fill("0987654321");
  await page.getByLabel("Địa chỉ nhận (số nhà, đường)").fill("20 Láng Hạ");
  await page.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  await page.getByLabel("Xã/Phường").fill("Phường Láng");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByLabel("Tên hàng hóa")).toBeVisible();
}

test("[US-19] khach le gui hang: khong co thu ho, khong tru phi vao thu ho, khong co doi soat va tai khoan nhan COD", async ({ page }) => {
  await login(page, "khach1@edms.vn");
  await toParcelStep(page);
  await expect(page.getByText("Tài khoản cá nhân gửi hàng không kèm thu hộ")).toBeVisible();
  await expect(page.getByLabel("Thu hộ tiền hàng (COD)")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Khấu trừ vào tiền thu hộ" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Người nhận trả phí" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đối soát" })).toHaveCount(0);

  await page.goto("/tai-khoan");
  await expect(page.getByRole("region", { name: "Thu hộ và đối soát" })).toContainText("dành cho shop đối tác");
  await page.goto("/doi-soat");
  await expect(page.getByRole("status")).toContainText("dành cho shop đối tác");
});

test("[US-19] shop doi tac: co thu ho COD, tru phi vao thu ho va muc Doi soat", async ({ page }) => {
  await login(page, "shop2@edms.vn");
  await toParcelStep(page);
  await expect(page.getByLabel("Thu hộ tiền hàng (COD)")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Khấu trừ vào tiền thu hộ" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đối soát" })).toBeVisible();
});
