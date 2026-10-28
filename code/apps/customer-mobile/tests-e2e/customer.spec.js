import { test, expect } from "@playwright/test";

// App Khach hang mobile chay ban web (react-native-web, cong 8083), khung dien thoai 390x844.
// Cung luong voi Web Khach hang; tren may ao Android xem .maestro/.
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";

test.beforeEach(async ({ page }) => {
  // window.confirm (dang xuat) -> bam Dong y
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await expect(page.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
});

async function login(page, email, password = PASSWORD) {
  await page.getByTestId("login-identity").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

test("[PB-01] khach vang lai xem trang chu, dich vu va so lieu tu API cong khai", async ({ page }) => {
  await expect(page.getByText("Giao hàng tiêu chuẩn")).toBeVisible();
  await expect(page.getByText("Giao hàng nhanh")).toBeVisible();
  await expect(page.getByText("quận/huyện đang phục vụ")).toBeVisible();
  await expect(page.getByTestId("home-login")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/m01-trang-chu.png` });
});

test("[PB-04] bang gia: doi Giao hang nhanh thi gia tang 50%", async ({ page }) => {
  await page.getByTestId("tab-pricing").click();
  await expect(page.getByText("15.000 ₫").first()).toBeVisible();
  await page.getByTestId("service-EXPRESS").click();
  await expect(page.getByText("22.500 ₫").first()).toBeVisible();
  await expect(page.getByText(/Phụ phí dịch vụ \+50%/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/m02-bang-gia-nhanh.png` });
});

test("[PB-01] vung phuc vu: go khong dau van tim ra, vung chua phuc vu bao ro", async ({ page }) => {
  await page.getByTestId("tab-coverage").click();
  const search = page.getByTestId("coverage-search");
  await search.fill("hoan kiem");
  await expect(page.getByTestId("coverage-status")).toHaveText("1 quận/huyện tại 1 tỉnh/thành");
  await expect(page.getByText("Hoàn Kiếm")).toBeVisible();
  await search.fill("Atlantis");
  await expect(page.getByTestId("coverage-status")).toHaveText('Chưa phục vụ khu vực "Atlantis"');
});

test("[US-06] bam Tao don khi chua dang nhap -> dang nhap -> quay lai dung man hinh tao don", async ({ page }) => {
  await page.getByTestId("home-create-order").click();
  await expect(page.getByText("Đăng nhập để tạo đơn và thanh toán.")).toBeVisible();
  await login(page, "khach1@edms.vn");
  await expect(page.getByText("Tạo đơn hàng")).toBeVisible();
  await expect(page.getByText("Đang đăng nhập: Khách Hàng 1")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/m03-tao-don.png` });
});

test("[US-06] tai khoan nhan vien bi tu choi, sai mat khau bao loi tieng Viet, nhap dung thi vao duoc", async ({
  page,
}) => {
  await page.getByTestId("home-login").click();
  await login(page, "kho1@edms.vn");
  await expect(page.getByTestId("login-error")).toContainText("Tài khoản nhân viên không dùng App Khách hàng");
  await login(page, "khach2@edms.vn", "sai-mat-khau");
  await expect(page.getByTestId("login-error")).toContainText("Email/số điện thoại hoặc mật khẩu không đúng");
  // Dang nhap dung xoa bo dem sai (5 lan sai lien tiep -> khoa 15 phut): chay test nhieu lan van on
  await login(page, "khach2@edms.vn");
  await expect(page.getByText("Tài khoản của tôi")).toBeVisible();
});

test("[US-07] dang ky doanh nghiep hien them o shop/MST, email trung bi tu choi", async ({ page }) => {
  await page.getByTestId("tab-account").click();
  await page.getByTestId("account-register").click();
  await page.getByTestId("reg-type-BUSINESS").click();
  await expect(page.getByTestId("reg-shopName")).toBeVisible();
  await expect(page.getByTestId("reg-taxCode")).toBeVisible();
  await page.getByTestId("reg-type-INDIVIDUAL").click();
  await expect(page.getByTestId("reg-taxCode")).toHaveCount(0);
  await page.getByTestId("reg-fullName").fill("Khách Trùng Email");
  await page.getByTestId("reg-email").fill("khach1@edms.vn");
  await page.getByTestId("reg-phone").fill("0912345678");
  await page.getByTestId("reg-password").fill(PASSWORD);
  await page.getByTestId("reg-submit").click();
  await expect(page.getByTestId("register-error")).toContainText("Email đã được sử dụng");
});

test("[US-08] dang xuat ve Trang chu; tai lai trang van la khach vang lai", async ({ page }) => {
  await page.getByTestId("home-login").click();
  await login(page, "shop1@edms.vn");
  await expect(page.getByText("Tài khoản của tôi")).toBeVisible();
  await expect(page.getByText("Doanh nghiệp / shop")).toBeVisible();
  await page.getByTestId("account-logout").click();
  await expect(page.getByTestId("home-login")).toBeVisible();
  await page.reload();
  await page.getByTestId("tab-account").click();
  await expect(page.getByText("Bạn chưa đăng nhập")).toBeVisible();
});
