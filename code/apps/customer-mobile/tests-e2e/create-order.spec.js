import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Sprint 3 tren App Khach hang (ban web, khung dien thoai): tao don 4 buoc (US-18), thu ho va
// ai tra phi (US-19), uoc tinh phi -> dang ky moi -> tao don giu nguyen du lieu (US-16).
// Chi file nay dung shop1 de tao don. Don va tai khoan thu nghiem duoc xoa qua mongosh trong
// CSDL local (API khong co chuc nang xoa don / tai khoan; e2e-guard da chan khi dung Atlas).
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";

function cleanup() {
  const script =
    "const ids = db.users.find({ email: /^e2e-mdraft\\d+@edms\\.vn$/ }).toArray().map((u) => u._id);" +
    'db.orders.deleteMany({ $or: [{ customerId: { $in: ids } }, { "receiver.name": /^E2E / }] });' +
    "db.pickuplocations.deleteMany({ customerId: { $in: ids } }); db.orderdrafts.deleteMany({ customerId: { $in: ids } });" +
    "db.users.deleteMany({ _id: { $in: ids } }).deletedCount";
  try {
    execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
  } catch {
    // may khong co Docker -> bo qua don dep
  }
}

test.afterAll(cleanup);

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await expect(page.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
});

async function fillReceiver(page, district) {
  await page.getByTestId("rc-name").fill("E2E Người Nhận Mobile");
  await page.getByTestId("rc-phone").fill("0977123456");
  await page.getByTestId("rc-address").fill("12 Nguyễn Huệ");
  await page.getByTestId("rc-district").fill(district);
  await page.getByTestId("rc-province").fill("TP Hồ Chí Minh");
  await page.getByTestId("rc-ward").fill("Bến Nghé");
}

test("[US-18] mobile: tao don 4 buoc voi thu ho, buoc 4 xem phi va so shipper thu, nhan ma van don", async ({ page }) => {
  await page.getByTestId("home-create-order").click();
  await page.getByTestId("login-identity").fill("shop1@edms.vn");
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByText("Bước 1/4 · Lấy hàng")).toBeVisible();
  await page.getByTestId("order-next").click();

  // Buoc 2: quan/huyen ngoai vung phuc vu bi chan ngay
  await fillReceiver(page, "Cần Giờ");
  await page.getByTestId("order-next").click();
  await expect(page.getByTestId("order-error")).toContainText("Cần Giờ, TP Hồ Chí Minh chưa thuộc vùng phục vụ");
  await page.getByTestId("rc-district").fill("Quận 1");
  await page.getByTestId("order-next").click();

  // Buoc 3: hang + thu ho 300.000 d, nguoi gui tra truoc bang tien mat
  await expect(page.getByText("Bước 3/4 · Hàng hóa & thanh toán")).toBeVisible();
  await page.getByTestId("it-name").fill("Mỹ phẩm");
  await page.getByTestId("it-weightGram").fill("600");
  await page.getByTestId("it-length").fill("15");
  await page.getByTestId("it-width").fill("10");
  await page.getByTestId("it-height").fill("8");
  await page.getByTestId("cod-enabled").click();
  await page.getByTestId("cod-amount").fill("300000");
  await page.getByTestId("fee-payer-SHOP_PREPAID").click();
  await page.getByTestId("prepaid-CASH").click();
  await page.getByTestId("order-next").click();

  // Buoc 4: phi du kien; nguoi gui tra truoc -> shipper chi thu tien hang
  await expect(page.getByTestId("order-quote")).toContainText("Cước cơ bản");
  await expect(page.getByTestId("order-quote")).toContainText("Shipper thu của người nhận");
  await expect(page.getByTestId("order-quote")).toContainText("300.000 ₫");
  await page.screenshot({ path: `${SHOT_DIR}/m11-tao-don-xac-nhan.png` });
  await page.getByTestId("order-submit").click();
  await expect(page.getByTestId("order-tracking-code")).toHaveText(/^EXP\d{10}$/);
  await expect(page.getByTestId("order-created")).toContainText("chờ bưu cục xác nhận");
});

test("[US-19] mobile: khau tru phi chi chon khi bat thu ho; thu ho nho hon phi thi khong cho xac nhan", async ({ page }) => {
  await page.getByTestId("home-create-order").click();
  await page.getByTestId("login-identity").fill("shop1@edms.vn");
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("order-next").click();
  await fillReceiver(page, "Quận 3");
  await page.getByTestId("order-next").click();
  await page.getByTestId("it-name").fill("Thẻ cào");
  await page.getByTestId("it-weightGram").fill("100");
  await page.getByTestId("it-length").fill("10");
  await page.getByTestId("it-width").fill("5");
  await page.getByTestId("it-height").fill("1");
  await expect(page.getByTestId("fee-payer-DEDUCT_FROM_COD")).toHaveAttribute("aria-disabled", "true");
  await page.getByTestId("cod-enabled").click();
  await page.getByTestId("cod-amount").fill("1000");
  await page.getByTestId("fee-payer-DEDUCT_FROM_COD").click();
  await page.getByTestId("order-next").click();
  await expect(page.getByTestId("order-cod-blocked")).toContainText("Tiền thu hộ nhỏ hơn phí vận chuyển");
  await expect(page.getByTestId("order-submit")).toHaveAttribute("aria-disabled", "true");
});

test("[US-16] mobile: khach vang lai uoc tinh phi -> Gui hang -> dang ky moi -> tao don dien san du lieu", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString().slice(-8);
  await page.getByTestId("home-estimate").click();
  await page.getByTestId("from-district").fill("cau giay");
  await page.getByRole("button", { name: "Chọn Cầu Giấy, Hà Nội" }).click();
  await page.getByTestId("to-district").fill("quan 1");
  await page.getByRole("button", { name: "Chọn Quận 1, TP Hồ Chí Minh" }).click();
  await page.getByTestId("est-weightGram").fill("1000");
  await page.getByTestId("est-length").fill("40");
  await page.getByTestId("est-width").fill("30");
  await page.getByTestId("est-height").fill("20");
  await page.getByTestId("estimate-submit").click();
  await expect(page.getByTestId("estimate-summary")).toContainText("tuyến liên miền · tính theo 4.800 g");
  await expect(page.getByTestId("estimate-option-STANDARD")).toContainText("115.000 ₫");
  await page.screenshot({ path: `${SHOT_DIR}/m12-uoc-tinh-phi.png` });
  await page.getByTestId("estimate-ship-STANDARD").click();

  // Chua dang nhap -> man hinh dang nhap -> chuyen sang dang ky, nhap don di cung
  await expect(page.getByText("Đăng nhập để tạo đơn và thanh toán.")).toBeVisible();
  await page.getByTestId("go-register").click();
  await page.getByTestId("reg-fullName").fill("Khách Mobile Mới");
  await page.getByTestId("reg-email").fill(`e2e-mdraft${stamp}@edms.vn`);
  await page.getByTestId("reg-phone").fill(`08${stamp}`);
  await page.getByTestId("reg-password").fill("Test@12345");
  await page.getByTestId("reg-submit").click();

  // Tai khoan moi: goi y them dia diem o Cau Giay; nguoi nhan + kien hang da dien san
  await expect(page.getByTestId("order-pickup-hint")).toContainText("Bạn ước tính phí gửi từ Cầu Giấy, Hà Nội");
  await page.getByTestId("pl-label").fill("Nhà riêng");
  await page.getByTestId("pl-contactName").fill("Khách Mobile Mới");
  await page.getByTestId("pl-contactPhone").fill(`08${stamp}`);
  await page.getByTestId("pl-address").fill("1 Xuân Thủy");
  await page.getByTestId("pl-district").fill("Cầu Giấy");
  await page.getByTestId("pl-province").fill("Hà Nội");
  await page.getByTestId("pl-ward").fill("Dịch Vọng Hậu");
  await page.getByTestId("pl-save").click();
  await expect(page.getByRole("radio", { name: "Nhà riêng" })).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("order-next").click();

  await expect(page.getByTestId("rc-district")).toHaveValue("Quận 1");
  await expect(page.getByTestId("rc-province")).toHaveValue("TP Hồ Chí Minh");
  await page.getByTestId("rc-name").fill("E2E Người Nhận Mobile");
  await page.getByTestId("rc-phone").fill("0977123456");
  await page.getByTestId("rc-address").fill("5 Lý Tự Trọng");
  await page.getByTestId("rc-ward").fill("Bến Nghé");
  await page.getByTestId("order-next").click();

  await expect(page.getByTestId("it-weightGram")).toHaveValue("1000");
  await expect(page.getByTestId("it-height")).toHaveValue("20");
  await page.getByTestId("it-name").fill("Đồ gia dụng");
  await page.getByTestId("order-next").click();

  await expect(page.getByTestId("order-quote")).toContainText("115.000 ₫");
  await page.getByTestId("order-submit").click();
  await expect(page.getByTestId("order-tracking-code")).toHaveText(/^EXP\d{10}$/);
  await expect(page.getByTestId("order-created")).toContainText("Phí vận chuyển: 115.000 ₫");
  await page.screenshot({ path: `${SHOT_DIR}/m13-tao-don-sau-dang-ky.png` });
});
