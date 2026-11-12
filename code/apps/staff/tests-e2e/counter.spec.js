import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-40: tiep nhan hang tai quay tren App Nhan vien (luong chinh de 14) va quy trinh lien vai tro:
//   kho1 (Hub Ha Noi) tim khach -> kiem hang -> bao gia + goi y phuong tien -> tao don (AT_HUB, phi khoa)
//   -> nguoi nhan tra cuu tren Web Khach hang; shop co tai khoan thay don trong "Don hang cua toi".
// Nguoi nhan "KT40 ..." va khach le so 0905550xxx: afterAll xoa qua mongosh (CSDL local, e2e-guard da kiem).
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const WEB_URL = process.env.E2E_WEB_URL || "http://localhost:5173";
const walkInPhone = `0905550${String(Date.now()).slice(-3)}`;

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
}

function cleanup() {
  try {
    mongo(
      'db.orders.deleteMany({ "receiver.name": /^KT40 / });' +
        "db.users.deleteMany({ walkIn: true, phone: /^0905550\\d{3}$/ });",
    );
    execFileSync("docker", ["exec", "edms-redis", "sh", "-c", "redis-cli --scan --pattern 'ratelimit:tracking:*' | xargs -r redis-cli del"], {
      stdio: "ignore",
    });
  } catch {
    // khong co Docker -> bo qua
  }
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function fillReceiver(page, name) {
  await page.getByTestId("ci-rc-name").fill(name);
  await page.getByTestId("ci-rc-phone").fill("0977 333 444");
  await page.getByTestId("ci-rc-address").fill("12 Nguyễn Huệ");
  await page.getByTestId("ci-rc-province").fill("TP Hồ Chí Minh");
  await page.getByTestId("ci-rc-ward").fill("sai gon"); // dia gioi 2025: khong con quan/huyen, go khong dau duoc
}

async function fillParcel(page, { name, weight, length, width, height }) {
  await page.getByTestId("ci-item-name").fill(name);
  await page.getByTestId("ci-weight").fill(String(weight));
  await page.getByTestId("ci-length").fill(String(length));
  await page.getByTestId("ci-width").fill(String(width));
  await page.getByTestId("ci-height").fill(String(height));
}

test("[US-40] quy trinh: kho tiep nhan tai quay cho khach le (xe may goi y xe tai, tra tien mat) -> nguoi nhan tra cuu tren Web", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Tiếp nhận tại quầy/ }).click();
  await expect(page.getByRole("heading", { name: "Tiếp nhận tại quầy" })).toBeVisible();

  // 1. Khach chua co tai khoan -> nhap ho ten de tao khach le
  await page.getByTestId("ci-phone").fill(walkInPhone);
  await page.getByTestId("ci-lookup").click();
  await page.getByTestId("ci-fullName").fill("Trần Khách Lẻ");

  // 2-3. Nguoi nhan, kiem hang: xe may -> goi y xe tai
  await fillReceiver(page, "KT40 Người Nhận Xe");
  await fillParcel(page, { name: "Xe máy điện", weight: 60000, length: 180, width: 60, height: 100 });
  await page.getByTestId("ci-vehicle-item").click();
  await page.getByTestId("ci-shop-code").fill("TIKI-555");
  await page.getByTestId("ci-submit").isDisabled();
  await page.getByTestId("ci-quote").click();
  await expect(page.getByTestId("ci-vehicle")).toContainText("Xe tải — Hàng là xe");

  // 4. Nguoi gui tra truoc tien mat tai quay
  await page.getByTestId("ci-payer-SHOP_PREPAID").click();
  await page.getByTestId("ci-method-CASH").click();
  await expect(page.getByTestId("ci-total")).toContainText("₫");
  await page.screenshot({ path: `${SHOT_DIR}/40-counter-form.png`, fullPage: true });
  await page.getByTestId("ci-submit").click();

  const created = page.getByTestId("ci-created");
  await expect(created).toContainText("Đã nhập kho (Đã nhận – Chưa giao)");
  await expect(created).toContainText("khách lẻ mới");
  await expect(created).toContainText("đã thu tại quầy");
  await expect(page.getByTestId("ci-created-vehicle")).toContainText("Xe tải");
  const code = (await page.getByTestId("ci-tracking-code").innerText()).trim();
  expect(code).toMatch(/^EXP\d{10}$/);
  await page.screenshot({ path: `${SHOT_DIR}/40-counter-created.png`, fullPage: true });

  // Nguoi nhan (thiet bi khac, khong dang nhap) tra cuu tren Web Khach hang
  const recipient = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await recipient.goto(`${WEB_URL}/tra-cuu?ma=${code}`);
  const result = recipient.getByRole("region", { name: "Kết quả tra cứu" });
  await expect(result).toContainText("Đã nhận – Chưa giao");
  await expect(result.getByRole("list", { name: "Hành trình" }).getByRole("listitem")).toHaveCount(3);
  await expect(result).toContainText("Trần Khách Lẻ");
  await recipient.close();

  // Lan sau khach quay lai: tim thay khach le, khong phai nhap lai ho ten
  await page.getByTestId("ci-new").click();
  await page.getByTestId("ci-phone").fill(walkInPhone);
  await page.getByTestId("ci-lookup").click();
  await expect(page.getByTestId("ci-customer")).toHaveText("Trần Khách Lẻ · khách lẻ");
});

test("[US-40] quy trinh: kho tiep nhan hang cua shop co tai khoan -> shop thay don trong Don hang cua toi tren Web", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Tiếp nhận tại quầy/ }).click();
  await page.getByTestId("ci-phone").fill("0900000043"); // shop3
  await page.getByTestId("ci-lookup").click();
  await expect(page.getByTestId("ci-customer")).toContainText("Shop 3");
  await fillReceiver(page, "KT40 Người Nhận Shop");
  await fillParcel(page, { name: "Giày", weight: 1200, length: 30, width: 20, height: 12 });
  await page.getByTestId("ci-shop-code").fill("SHOPEE-KT40");
  await page.getByTestId("ci-quote").click();
  await expect(page.getByTestId("ci-vehicle")).toContainText("Xe máy");
  await page.getByTestId("ci-submit").click();
  const code = (await page.getByTestId("ci-tracking-code").innerText()).trim();

  const shop = await (await browser.newContext()).newPage();
  await shop.goto(`${WEB_URL}/dang-nhap?next=%2Fdon-hang`);
  await shop.getByLabel("Email hoặc số điện thoại").fill("shop3@edms.vn");
  await shop.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await shop.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await shop.getByLabel("Tìm đơn").fill("SHOPEE-KT40");
  await shop.getByRole("button", { name: "Tìm", exact: true }).click();
  const row = shop.getByRole("list", { name: "Danh sách đơn hàng" }).getByRole("link", { name: new RegExp(code) });
  await expect(row).toContainText("Đã nhận – Chưa giao");
  await expect(row).toContainText("Đã nhập kho");
  await shop.close();
});

test("[US-40] chua tim khach / chua bao gia thi chua tao don duoc; so cua nhan vien bi tu choi", async ({ page }) => {
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Tiếp nhận tại quầy/ }).click();
  await expect(page.getByTestId("ci-submit")).toHaveAttribute("aria-disabled", "true");
  await page.getByTestId("ci-phone").fill("0900000011"); // kho1
  await page.getByTestId("ci-lookup").click();
  await expect(page.getByTestId("ci-error")).toContainText("thuộc tài khoản nhân viên");
});
