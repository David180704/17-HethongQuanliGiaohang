import { test, expect, request } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const PHONE = { width: 390, height: 844 };

// Du lieu do test tao ra deu mang tien to nay de don sach sau khi chay.
const E2E_PROVINCE = "Tỉnh E2E";

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function cleanupE2EAreas() {
  const api = await request.newContext({ baseURL: API_URL });
  const loginRes = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const token = (await loginRes.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const list = await api.get("/serviceAreas", { params: { search: E2E_PROVINCE, limit: 100 }, headers });
  for (const area of (await list.json()).data) {
    await api.delete(`/serviceAreas/${area._id}`, { headers });
  }
  await api.dispose();
}

test.beforeEach(async ({ page }) => {
  // window.confirm (xoa, dang xuat) -> bam Dong y
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterAll(cleanupE2EAreas);

test("chua dang nhap chi thay man hinh dang nhap", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EDMS Nhân viên" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByText(/Máy chủ: http:\/\/localhost:4044/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-login.png`, fullPage: true });
});

test("tai khoan CUSTOMER bi server tu choi o App Nhan vien", async ({ page }) => {
  await login(page, "khach1@edms.vn");
  await expect(page.getByRole("alert")).toContainText("Tài khoản khách hàng không đăng nhập được App Nhân viên");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-customer-rejected.png`, fullPage: true });
});

test("sai mat khau hien thong bao loi tieng Viet", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin@edms.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("không đúng");
});

test("ADMIN vao trang quan tri, so ban ghi that, phien con sau khi tai lai trang", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await expect(page.getByText("Admin EDMS")).toBeVisible();
  for (const name of ["Người dùng", "Tuyến", "Khu vực phục vụ", "Loại dịch vụ"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  }
  await expect(page.getByText(/\d+ bản ghi/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Bảng giá", exact: true })).toBeDisabled();
  await expect(page.getByText("Sắp có · #13 · Sprint 3")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-admin-home-desktop.png`, fullPage: true });

  await page.reload();
  await expect(page.getByText("Admin EDMS")).toBeVisible();
});

test("ADMIN: danh sach tuyen tu seed, form them moi bat loi bo trong", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Tuyến", exact: true }).click();
  await expect(page.getByText("Nội thành Hà Nội")).toBeVisible();
  await expect(page.getByText(/Tổng \d+ bản ghi/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-routes-list.png`, fullPage: true });

  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await expect(page.getByRole("heading", { name: "Thêm tuyến" })).toBeVisible();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Vui lòng nhập mã tuyến");
  await page.screenshot({ path: `${SHOT_DIR}/05-routes-form-validation.png`, fullPage: true });
});

test("ADMIN: them, sua, xoa khu vuc phuc vu tren du lieu that", async ({ page }) => {
  const district = `Quận E2E ${Date.now()}`;
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Khu vực phục vụ", exact: true }).click();

  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.getByLabel("Tỉnh/Thành phố", { exact: true }).fill(E2E_PROVINCE);
  await page.getByLabel("Quận/Huyện", { exact: true }).fill(district);
  await page.getByRole("radio", { name: "Miền Bắc" }).click();
  // Lua chon tuyen tai dong tu GET /routes
  await page.getByRole("radio", { name: /R-HN-NOI/ }).click();
  await page.screenshot({ path: `${SHOT_DIR}/06-area-create-form.png`, fullPage: true });
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã thêm mới")).toBeVisible();
  await expect(page.getByText(district)).toBeVisible();

  await page.getByRole("button", { name: `Sửa ${district}` }).click();
  await page.getByRole("radio", { name: "Miền Trung" }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi")).toBeVisible();

  await page.getByPlaceholder("Tìm theo tỉnh, quận/huyện...").fill(district);
  await expect(page.getByText(/Tổng 1 bản ghi/)).toBeVisible();
  await expect(page.getByText("Miền Trung")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-area-after-edit.png`, fullPage: true });

  await page.getByRole("button", { name: `Xóa ${district}` }).click();
  await expect(page.getByText(`Đã xóa "${district}"`)).toBeVisible();
  await expect(page.getByText(/Tổng 0 bản ghi/)).toBeVisible();
});

test("ADMIN: o so nhan dau phay thap phan, server tu choi ma dich vu trung", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Loại dịch vụ", exact: true }).click();
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.getByRole("radio", { name: "Gửi nhanh" }).click();
  await page.getByLabel("Tên hiển thị", { exact: true }).fill("Trùng mã");
  await page.getByLabel("Hệ số phụ phí", { exact: true }).fill("0,5");
  await page.getByLabel("Số ngày giao dự kiến", { exact: true }).fill("1");
  await expect(page.getByRole("checkbox", { name: "Đang hoạt động" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  // EXPRESS da co san trong seed -> server bao trung, form van mo de sua
  await expect(page.getByRole("alert")).toContainText("Dữ liệu bị trùng với bản ghi đã tồn tại");
  await expect(page.getByRole("heading", { name: "Thêm loại dịch vụ" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-service-type-duplicate.png`, fullPage: true });
});

test.describe("giao dien dien thoai", () => {
  test.use({ viewport: PHONE });

  test("ADMIN tren dien thoai: luoi 2 cot", async ({ page }) => {
    await login(page, "admin@edms.vn");
    await expect(page.getByText("Admin EDMS")).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/09-admin-home-phone.png`, fullPage: true });
  });

  test("form dai nhat (them nguoi dung): nut Luu va loi luon trong man hinh", async ({ page }) => {
    await login(page, "admin@edms.vn");
    await page.getByRole("button", { name: "Người dùng", exact: true }).click();
    await page.getByRole("button", { name: "+ Thêm mới" }).click();
    // Chon tai xe -> hien them o chon nhieu tuyen (tai tu GET /routes)
    await page.getByRole("radio", { name: "Tài xế giao nhận" }).click();
    await expect(page.getByRole("checkbox", { name: /R-HN-NOI/ })).toBeVisible();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Vui lòng nhập họ tên");
    // ratio 1 = phai nam TRON trong man hinh (mac dinh chi can lo 1 pixel la pass)
    await expect(page.getByRole("alert")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Hủy", exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${SHOT_DIR}/13-user-form-phone.png` });
  });

  test("HUB_STAFF thay hub phu trach va cong viec tai hub", async ({ page }) => {
    await login(page, "kho1@edms.vn");
    // "Đăng xuất" chi co o trang chu - khong de chu "Nhân viên kho" o dong phu de
    // cua man hinh dang nhap lam test pass nham khi dang nhap that bai.
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "EDMS Nhân viên" })).toBeVisible();
    await expect(page.getByText(/Hub phụ trách: .+\((HUB|PO)-/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Duyệt đơn mới" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Người dùng" })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/10-hub-home-phone.png`, fullPage: true });
  });

  test("SHIPPER thay tuyen, the ca hom nay va khong co menu quan tri", async ({ page }) => {
    await login(page, "taixe1@edms.vn");
    await expect(page.getByText("Ca hôm nay")).toBeVisible();
    await expect(page.getByText(/Tuyến: R-/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Người dùng" })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/11-shipper-home-phone.png`, fullPage: true });
  });
});

test("dang xuat quay ve man hinh dang nhap", async ({ page }) => {
  await login(page, "taixe1@edms.vn");
  await expect(page.getByText("Ca hôm nay")).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
});

test("song song: ADMIN va SHIPPER dang nhap cung luc, phien khong de nhau", async ({ browser }) => {
  // Moi context = mot "thiet bi" rieng (storage rieng), giong 2 nguoi that.
  const adminContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const shipperContext = await browser.newContext({ viewport: PHONE });
  const adminPage = await adminContext.newPage();
  const shipperPage = await shipperContext.newPage();
  for (const p of [adminPage, shipperPage]) p.on("dialog", (dialog) => dialog.accept());

  await Promise.all([login(adminPage, "admin@edms.vn"), login(shipperPage, "taixe1@edms.vn")]);
  await expect(adminPage.getByText("Admin EDMS")).toBeVisible();
  await expect(shipperPage.getByText("Ca hôm nay")).toBeVisible();
  await adminPage.screenshot({ path: `${SHOT_DIR}/12-parallel-admin.png` });
  await shipperPage.screenshot({ path: `${SHOT_DIR}/12-parallel-shipper.png` });

  // Admin dang xuat khong lam tai xe bi dang xuat theo
  await adminPage.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(adminPage.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await shipperPage.reload();
  await expect(shipperPage.getByText("Ca hôm nay")).toBeVisible();

  await adminContext.close();
  await shipperContext.close();
});
