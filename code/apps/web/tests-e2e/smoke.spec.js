import { test, expect } from "@playwright/test";

const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const PHONE = { width: 390, height: 844 };

async function loginOnPage(page, email) {
  await page.getByLabel("Email hoặc số điện thoại").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("khach vang lai xem trang chu khong can dang nhap, du lieu tu API cong khai", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Gửi hàng toàn quốc, theo dõi từng chặng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Giao hàng tiêu chuẩn" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Giao hàng nhanh" })).toBeVisible();
  await expect(page.getByText("quận/huyện đang phục vụ")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-home-guest.png`, fullPage: true });
});

test("bang gia: doi dich vu thi gia doi theo he so phu phi", async ({ page }) => {
  await page.goto("/bang-gia");
  const innerDistrict = page.locator("section", { has: page.getByRole("heading", { name: "Nội quận" }) });
  // Seed: noi quan bac dau 15.000 d; gui nhanh he so 0.5 -> 22.500 d
  await expect(innerDistrict.getByText("15.000 ₫").first()).toBeVisible();
  await page.getByRole("button", { name: "Giao hàng nhanh" }).click();
  await expect(innerDistrict.getByText("22.500 ₫").first()).toBeVisible();
  await expect(page.getByText("Phụ phí dịch vụ +50%")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-pricing-express.png`, fullPage: true });
});

test("vung phuc vu: tim thay Hoan Kiem, bao ro khi khong phuc vu", async ({ page }) => {
  await page.goto("/vung-phuc-vu");
  const search = page.getByLabel("Tìm vùng phục vụ");
  await search.fill("Hoàn Kiếm");
  await expect(page.getByRole("heading", { name: "Hà Nội" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 quận/huyện tại 1 tỉnh/thành");
  await page.screenshot({ path: `${SHOT_DIR}/03-coverage-search.png`, fullPage: true });
  await search.fill("Atlantis");
  await expect(page.getByRole("status")).toHaveText('Chưa phục vụ khu vực "Atlantis"');
});

test("bam Tao don khi chua dang nhap -> dang nhap -> quay lai dung trang tao don", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Tạo đơn", exact: true }).click();
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftao-don$/);
  await expect(page.getByText("Đăng nhập để tạo đơn và thanh toán.")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-login-from-create-order.png`, fullPage: true });

  await loginOnPage(page, "khach1@edms.vn");
  await expect(page).toHaveURL(/\/tao-don$/);
  await expect(page.getByRole("heading", { name: "Tạo đơn hàng" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/05-create-order-logged-in.png`, fullPage: true });
});

test("tai khoan nhan vien bi server tu choi o App Khach hang", async ({ page }) => {
  await page.goto("/dang-nhap");
  await loginOnPage(page, "taixe1@edms.vn");
  await expect(page.getByRole("alert")).toContainText("Tài khoản nhân viên không dùng App Khách hàng");
  await expect(page).toHaveURL(/\/dang-nhap$/);
});

test("da dang nhap ma vao trang dang nhap thi ve trang chu (guard nguoc)", async ({ page }) => {
  await page.goto("/dang-nhap");
  await loginOnPage(page, "khach1@edms.vn");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dang-nhap");
  await expect(page).toHaveURL(/\/$/);
});

test("?next tro ra ngoai site bi bo qua (chan open redirect)", async ({ page }) => {
  await page.goto("/dang-nhap?next=//evil.example.com");
  await loginOnPage(page, "khach1@edms.vn");
  await expect(page).toHaveURL("http://localhost:5173/");
});

test("dang ky: doanh nghiep hien them o shop/MST, email trung bi bao loi tu server", async ({ page }) => {
  await page.goto("/dang-ky");
  await page.getByRole("radio", { name: "Doanh nghiệp / shop" }).click();
  await expect(page.getByLabel("Tên shop / doanh nghiệp")).toBeVisible();
  await expect(page.getByLabel("Mã số thuế")).toBeVisible();

  await page.getByRole("radio", { name: "Cá nhân" }).click();
  await expect(page.getByLabel("Mã số thuế")).toHaveCount(0);
  await page.getByLabel("Họ tên").fill("Khách Trùng Email");
  await page.getByLabel("Email").fill("khach1@edms.vn");
  await page.getByLabel("Số điện thoại").fill("0912345678");
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email đã được sử dụng");
  await page.screenshot({ path: `${SHOT_DIR}/06-register-duplicate.png`, fullPage: true });
});

test("dang xuat xong vao trang tai khoan bi chuyen sang dang nhap", async ({ page }) => {
  await page.goto("/dang-nhap");
  await loginOnPage(page, "khach1@edms.vn");
  // Cho dang nhap xong (da luu token) roi moi tai trang khac
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/tai-khoan");
  await expect(page.getByRole("heading", { name: "Tài khoản của tôi" })).toBeVisible();
  await expect(page.getByText("khach1@edms.vn")).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  await page.goto("/tai-khoan");
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan$/);
});

test.describe("dien thoai", () => {
  test.use({ viewport: PHONE });

  test("trang chu va bang gia vua man hinh dien thoai, khong tran ngang", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Giao hàng nhanh" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOT_DIR}/07-home-phone.png`, fullPage: true });

    await page.goto("/bang-gia");
    await expect(page.getByRole("heading", { name: "Liên miền" })).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/08-pricing-phone.png`, fullPage: true });
  });
});
