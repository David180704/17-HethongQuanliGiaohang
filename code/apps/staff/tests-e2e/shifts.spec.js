import { test, expect, request } from "@playwright/test";

// US-23: ca lam viec tren App Nhan vien va quy trinh lien vai tro: kho1 (Hub Ha Noi) xep ca hom nay cho
// taixe5 tren tuyen R-HN-NOI -> taixe5 dang nhap thay ca cua minh o the "Ca hom nay". Ca thu nghiem dat ten
// "KT23 ..." va xoa qua API o afterAll.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";

async function removeTestShifts() {
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  for (let offset = -1; offset <= 2; offset += 1) {
    const day = new Date(Date.now() + 7 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10);
    const shifts = (await (await api.get("/shifts", { params: { date: day }, headers })).json()).data || [];
    for (const shift of shifts.filter((s) => s.name.startsWith("KT23 "))) await api.delete(`/shifts/${shift._id}`, { headers });
  }
  await api.dispose();
}

test.beforeAll(removeTestShifts);
test.afterAll(removeTestShifts);

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("[US-23] quy trinh: kho xep ca hom nay cho tai xe tren tuyen cua hub -> tai xe dang nhap thay ca cua minh", async ({
  page,
  browser,
}) => {
  test.setTimeout(2 * 60_000);
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Ca làm việc/ }).click();
  await expect(page.getByRole("heading", { name: "Ca làm việc" })).toBeVisible();

  await page.getByTestId("shift-add").click();
  const form = page.getByTestId("shift-form");
  await form.getByRole("radio", { name: "R-HN-NOI" }).click();
  await page.getByTestId("shift-name").fill("KT23 Ca kiểm thử");
  await page.getByTestId("shift-start").fill("06:00");
  await page.getByTestId("shift-end").fill("05:00");
  await form.getByRole("checkbox", { name: "Tài Xế 5" }).click();
  await page.getByTestId("shift-save").click();
  await expect(page.getByTestId("shift-error")).toContainText("Giờ kết thúc phải sau giờ bắt đầu");

  await page.getByTestId("shift-end").fill("06:30");
  await page.getByTestId("shift-save").click();
  await expect(page.getByTestId("shift-notice")).toContainText("Đã thêm KT23 Ca kiểm thử");
  const card = page.locator('[data-testid^="shift-R-HN-NOI-"]').filter({ hasText: "KT23 Ca kiểm thử" });
  await expect(card).toContainText("06:00–06:30");
  await expect(card).toContainText("Tài Xế 5");
  await page.screenshot({ path: `${SHOT_DIR}/23-ca-lam-viec.png`, fullPage: true });

  // Tai xe dang nhap (thiet bi khac) thay ca hom nay cua minh
  const driver = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(driver, "taixe5@edms.vn");
  await expect(driver.getByTestId("shipper-shift")).toContainText("KT23 Ca kiểm thử 06:00–06:30 · R-HN-NOI");
  await driver.screenshot({ path: `${SHOT_DIR}/23-tai-xe-thay-ca.png`, fullPage: true });
  await driver.close();

  // Xoa ca -> tai xe khong con ca do
  await card.getByRole("button", { name: /^Xóa R-HN-NOI-/ }).click();
  await expect(page.getByTestId("shift-notice")).toContainText("Đã xóa KT23 Ca kiểm thử");
});

test("[US-23] kho HCM chi thay tuyen cua hub minh; trung gio voi ca khac cua cung tai xe bi chan", async ({ page }) => {
  await login(page, "kho2@edms.vn");
  await page.getByRole("button", { name: /Ca làm việc/ }).click();
  await page.getByTestId("shift-add").click();
  const form = page.getByTestId("shift-form");
  await expect(form.getByRole("radio", { name: "R-HCM-NOI" })).toBeVisible();
  await expect(form.getByRole("radio", { name: "R-HN-NOI" })).toHaveCount(0);

  await page.getByTestId("shift-name").fill("KT23 Ca một");
  await page.getByTestId("shift-start").fill("07:00");
  await page.getByTestId("shift-end").fill("08:00");
  await form.getByRole("checkbox", { name: "Tài Xế 3" }).click();
  await page.getByTestId("shift-save").click();
  await expect(page.getByTestId("shift-notice")).toContainText("Đã thêm KT23 Ca một");
  await page.getByTestId("shift-add").click();
  await page.getByTestId("shift-name").fill("KT23 Ca hai");
  await page.getByTestId("shift-start").fill("07:30");
  await page.getByTestId("shift-end").fill("09:00");
  await page.getByTestId("shift-form").getByRole("checkbox", { name: "Tài Xế 3" }).click();
  await page.getByTestId("shift-save").click();
  await expect(page.getByTestId("shift-error")).toContainText("Tài Xế 3 đã có ca \"KT23 Ca một\" 07:00–08:00 cùng ngày");
});
