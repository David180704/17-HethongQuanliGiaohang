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
  // Phai ve TRANG CHU va o lai do. Loi cu: header hien link "Dang nhap" trong mot
  // khung hinh roi ProtectedRoute day sang /dang-nhap?next=... -> chi kiem link do
  // thi test pass/fail tuy may nhanh hay cham. Noi dung trang chu khong bao gio hien
  // khi con loi, nen kiem no.
  await expect(page.getByRole("heading", { name: "Gửi hàng toàn quốc, theo dõi từng chặng" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
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

test.describe("cache 30 giay phia web", () => {
  test("chuyen qua lai cac trang trong 30 giay: API bang gia chi goi 1 lan", async ({ page }) => {
    const calls = [];
    page.on("request", (req) => {
      if (req.url().includes("/public/price-tables")) calls.push(req.url());
    });
    await page.goto("/bang-gia");
    await expect(page.getByRole("heading", { name: "Nội quận" })).toBeVisible();
    // Dieu huong trong SPA (khong tai lai trang) -> cache trong bo nho van con
    await page.getByRole("link", { name: "Trang chủ" }).first().click();
    await page.getByRole("link", { name: "Bảng giá" }).first().click();
    await expect(page.getByRole("heading", { name: "Nội quận" })).toBeVisible();
    await page.getByRole("link", { name: "Vùng phục vụ" }).first().click();
    await page.getByRole("link", { name: "Bảng giá" }).first().click();
    await expect(page.getByTestId("updated-at")).toContainText("tự làm mới mỗi 30 giây");
    expect(calls).toHaveLength(1);
  });

  test("de trang mo: sau 30 giay tu goi lai API dung 1 lan de lam moi", async ({ page }) => {
    test.setTimeout(90_000);
    let calls = 0;
    page.on("request", (req) => {
      if (req.url().includes("/public/price-tables")) calls += 1;
    });
    await page.goto("/bang-gia");
    await expect(page.getByTestId("updated-at")).toBeVisible();
    const firstStamp = await page.getByTestId("updated-at").textContent();
    expect(calls).toBe(1);

    await expect.poll(() => calls, { timeout: 40_000, intervals: [1000] }).toBe(2);
    await expect(page.getByTestId("updated-at")).not.toHaveText(firstStamp);
  });

  test("ho so nguoi truoc ve tre sau khi doi nguoi dung thi khong vao cache", async ({ page }) => {
    // Giu phan hoi /auth/me dau tien (cua khach1) lai, chi tra ve SAU khi khach2 da dang nhap.
    let openGate;
    const gate = new Promise((resolve) => (openGate = resolve));
    let seen = 0;
    await page.route("**/auth/me", async (route) => {
      if (route.request().method() !== "GET" || seen++ > 0) return route.continue();
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    });

    await page.goto("/dang-nhap");
    await loginOnPage(page, "khach1@edms.vn");
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name: "Khách Hàng 1" }).click(); // /auth/me cua khach1 bat dau, bi giu lai
    await expect(page.getByText("Đang tải...")).toBeVisible();
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await page.getByRole("link", { name: "Đăng nhập" }).click();
    await loginOnPage(page, "khach2@edms.vn");
    await expect(page.getByRole("link", { name: "Khách Hàng 2" })).toBeVisible();

    const delivered = page.waitForResponse("**/auth/me");
    openGate(); // phan hoi cua khach1 gio moi ve
    await delivered;
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // Dieu huong trong SPA (khong tai lai trang) de cache trong bo nho van con
    await page.getByRole("link", { name: "Khách Hàng 2" }).click();
    await expect(page.getByText("khach2@edms.vn")).toBeVisible();
    await expect(page.getByText("khach1@edms.vn")).toHaveCount(0);
  });
});
