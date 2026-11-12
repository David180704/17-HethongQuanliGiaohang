import { test, expect, request } from "@playwright/test";

// US-42 quy trinh lien app: shop2 khai bao tai khoan nhan thu ho tren Web Khach hang (sai so tai khoan bi chan,
// ten tu bo dau in hoa) -> mo App Khach hang (dien thoai) thay dung tai khoan, doi sang ngan hang khac -> Web thay
// tai khoan moi. afterAll xoa tai khoan qua API.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const CUSTOMER_APP_URL = process.env.E2E_CUSTOMER_URL || "http://localhost:8083";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const EMAIL = "shop2@edms.vn";

async function removeAccount() {
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: EMAIL, password: PASSWORD } });
  await api.delete("/profile/bank-account", { headers: { Authorization: `Bearer ${(await login.json()).data.accessToken}` } });
  await api.dispose();
}

test.beforeAll(removeAccount);
test.afterAll(removeAccount);

test("[US-42] quy trinh: shop khai bao tai khoan nhan thu ho tren Web -> App Khach hang thay va doi -> Web thay tai khoan moi", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/dang-nhap?next=%2Ftai-khoan");
  await page.getByLabel("Email hoặc số điện thoại").fill(EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  const section = page.getByRole("region", { name: "Tài khoản nhận tiền thu hộ" });
  await expect(section.getByTestId("bank-summary")).toContainText("Chưa khai báo");
  await section.getByRole("button", { name: "Khai báo" }).click();
  await section.getByLabel("Ngân hàng").selectOption("VCB");
  await section.getByLabel("Số tài khoản").fill("12345");
  await section.getByLabel("Chủ tài khoản").fill("Trần Thị Bích");
  await section.getByRole("button", { name: "Lưu tài khoản" }).click();
  await expect(section.getByRole("alert")).toContainText("Số tài khoản gồm 6 đến 19 chữ số");
  await section.getByLabel("Số tài khoản").fill("0011 0099 88776");
  await section.getByRole("button", { name: "Lưu tài khoản" }).click();
  await expect(section.getByTestId("bank-summary")).toHaveText("Vietcombank · 0011009988776 · TRAN THI BICH");
  await page.screenshot({ path: `${SHOT_DIR}/42-tai-khoan-thu-ho.png`, fullPage: true });

  // App Khach hang tren dien thoai: cung tai khoan, doi sang Techcombank
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await phone.goto(CUSTOMER_APP_URL);
  await expect(phone.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
  await phone.getByTestId("home-login").click();
  await phone.getByTestId("login-identity").fill(EMAIL);
  await phone.getByTestId("login-password").fill(PASSWORD);
  await phone.getByTestId("login-submit").click();
  await expect(phone.getByTestId("bank-summary")).toHaveText("Vietcombank · 0011009988776 · TRAN THI BICH");
  await phone.getByTestId("bank-edit").click();
  await phone.getByTestId("bank-code-TCB").click();
  await phone.getByTestId("bank-number").fill("19033344455");
  await phone.getByTestId("bank-save").click();
  await expect(phone.getByTestId("bank-notice")).toContainText("Đã lưu tài khoản nhận tiền thu hộ");
  await expect(phone.getByTestId("bank-summary")).toHaveText("Techcombank · 19033344455 · TRAN THI BICH");
  await phone.screenshot({ path: `${SHOT_DIR}/42-app-kh-doi-tai-khoan.png`, fullPage: true });
  await phone.close();

  // Web tai lai thay tai khoan moi
  await page.reload();
  await expect(section.getByTestId("bank-summary")).toHaveText("Techcombank · 19033344455 · TRAN THI BICH");
});
