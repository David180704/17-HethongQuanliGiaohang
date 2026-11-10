import { test, expect, request } from "@playwright/test";

// US-24: nang luc moi ca 3 cap. Quy trinh lien vai tro: quan tri vien dat mac dinh he thong -> kho1 (Hub Ha Noi)
// dat nang luc rieng cho Tai Xe 5 tren tuyen R-HN-NOI -> bo ghi de thi tro lai theo tuyen. afterAll tra lai
// mac dinh he thong va bo ghi de cua Tai Xe 5 qua API.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
let original;

async function adminApi() {
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  return { api, headers };
}

test.beforeAll(async () => {
  const { api, headers } = await adminApi();
  original = (await (await api.get("/capacity", { headers })).json()).data;
  await api.dispose();
});

test.afterAll(async () => {
  const { api, headers } = await adminApi();
  await api.put("/capacity/system", { headers, data: original.system });
  const route = original.routes.find((r) => r.code === "R-HN-NOI");
  const driver = route.shippers.find((s) => s.fullName === "Tài Xế 5");
  await api.put(`/capacity/shippers/${driver._id}`, {
    headers,
    data: { maxPickupPerShift: driver.maxPickupPerShift, maxDeliveryPerShift: driver.maxDeliveryPerShift },
  });
  await api.dispose();
});

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("[US-24] quy trinh: admin dat mac dinh he thong -> kho dat nang luc rieng cho tai xe -> bo ghi de tro lai theo tuyen", async ({
  page,
  browser,
}) => {
  test.setTimeout(2 * 60_000);
  // 1. Quan tri vien doi mac dinh he thong
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: /Năng lực mỗi ca/ }).click();
  await expect(page.getByRole("heading", { name: "Năng lực mỗi ca" })).toBeVisible();
  await page.getByTestId("cap-system-edit").click();
  await page.getByTestId("cap-pickup").fill("0");
  await page.getByTestId("cap-save").click();
  await expect(page.getByTestId("cap-error")).toContainText("từ 1 đến 500");
  await page.getByTestId("cap-pickup").fill("21");
  await page.getByTestId("cap-delivery").fill("31");
  await page.getByTestId("cap-save").click();
  await expect(page.getByTestId("cap-notice")).toContainText("Đã lưu năng lực mặc định hệ thống");
  await expect(page.getByTestId("cap-system")).toContainText("Lấy 21 · Giao 31 đơn / ca");

  // 2. Nhan vien kho Ha Noi (thiet bi khac): khong sua duoc mac dinh, chi thay tuyen hub minh
  const kho = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(kho, "kho1@edms.vn");
  await kho.getByRole("button", { name: /Năng lực mỗi ca/ }).click();
  await expect(kho.getByTestId("cap-system")).toContainText("Lấy 21 · Giao 31 đơn / ca");
  await expect(kho.getByTestId("cap-system-edit")).toHaveCount(0);
  await expect(kho.getByTestId("cap-route-R-HN-NOI")).toBeVisible();
  await expect(kho.getByTestId("cap-route-R-HCM-NOI")).toHaveCount(0);

  const row = kho.locator('[data-testid^="cap-shipper-R-HN-NOI-"]').filter({ hasText: "Tài Xế 5" });
  await expect(row).toContainText("(theo tuyến)");
  await row.getByRole("button", { name: "Sửa năng lực Tài Xế 5" }).click();
  await kho.getByTestId("cap-pickup").fill("4");
  await kho.getByTestId("cap-delivery").fill("");
  await kho.getByTestId("cap-save").click();
  await expect(kho.getByTestId("cap-notice")).toContainText("Đã lưu năng lực Tài Xế 5");
  await expect(row).toContainText("Lấy 4 (riêng)");
  await expect(row).toContainText("(theo tuyến)");
  await kho.screenshot({ path: `${SHOT_DIR}/24-nang-luc.png`, fullPage: true });

  // 3. Bo ghi de -> tro lai nang luc tuyen
  await row.getByRole("button", { name: "Sửa năng lực Tài Xế 5" }).click();
  await kho.getByTestId("cap-pickup").fill("");
  await kho.getByTestId("cap-save").click();
  await expect(kho.getByTestId("cap-notice")).toContainText("Đã lưu năng lực Tài Xế 5");
  await expect(row).not.toContainText("(riêng)");
  await kho.close();
});
