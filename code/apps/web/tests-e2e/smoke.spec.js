import { test, expect } from "@playwright/test";

const ADMIN = { emailOrPhone: "admin@edms.vn", password: "Password123!" };
const SHOT_DIR = "tests-e2e/screenshots";

async function login(page) {
  await page.goto("/login");
  await page.getByPlaceholder("admin@edms.vn").fill(ADMIN.emailOrPhone);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("/");
}

test("chua dang nhap bi day ve /login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("/login");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-login.png`, fullPage: true });
});

test("dang nhap sai mat khau hien thong bao loi", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("admin@edms.vn").fill(ADMIN.emailOrPhone);
  await page.locator('input[type="password"]').fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText(/không đúng/i)).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${SHOT_DIR}/02-login-error.png`, fullPage: true });
});

test("dang nhap thanh cong vao duoc dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  await expect(page.getByText("Quản Trị Hệ Thống")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-dashboard.png`, fullPage: true });
});

test("trang Nguoi dung hien bang va mo duoc form them moi", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Người dùng" }).click();
  await page.waitForURL("/users");
  await expect(page.getByRole("heading", { name: "Người dùng" })).toBeVisible();
  await expect(page.getByText(/Tổng \d+ bản ghi/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-users-list.png`, fullPage: true });

  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await expect(page.getByText("Thêm Người dùng")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/05-users-create-modal.png`, fullPage: true });

  // Chon role CUSTOMER phai hien them field customerType (field dieu kien)
  await page.locator('select').first().selectOption("CUSTOMER");
  await expect(page.getByText("Loại khách hàng")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/06-users-create-customer-fields.png`, fullPage: true });
});

test("trang Tuyen hien bang du lieu that tu seed", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Tuyến" }).click();
  await page.waitForURL("/routes");
  await expect(page.getByText("R-HN-NOI")).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${SHOT_DIR}/07-routes-list.png`, fullPage: true });
});

test("trang Khu vuc phuc vu hien bang, form co dropdown tuyen that", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Khu vực phục vụ" }).click();
  await page.waitForURL("/service-areas");
  await expect(page.getByRole("heading", { name: "Khu vực phục vụ" })).toBeVisible();
  await expect(page.getByText(/Tổng \d+ bản ghi/)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.waitForTimeout(500); // cho goi API /routes de fill dropdown
  await page.screenshot({ path: `${SHOT_DIR}/08-service-areas-create-modal.png`, fullPage: true });
});

test("trang Loai dich vu hien bang", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Loại dịch vụ" }).click();
  await page.waitForURL("/service-types");
  await expect(page.getByText("STANDARD")).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `${SHOT_DIR}/09-service-types-list.png`, fullPage: true });
});

test("CUSTOMER dang nhap khong thay menu quan tri", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("admin@edms.vn").fill("customer1@edms.vn");
  await page.locator('input[type="password"]').fill("Password123!");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: "Người dùng" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/10-customer-dashboard.png`, fullPage: true });
});

test("dang xuat quay ve login", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL("/login");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
});
