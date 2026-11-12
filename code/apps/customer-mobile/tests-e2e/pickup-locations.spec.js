import { test, expect, request } from "@playwright/test";

// US-15 tren App Khach hang (ban web, khung dien thoai). Chi file nay dung
// khach6@edms.vn (Web Khach hang dung khach5) de hai bo test chay song song duoc.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const EMAIL = "khach6@edms.vn";
const SHOT_DIR = "tests-e2e/screenshots";
const LABEL = "E2E Shop Tân Mỹ";

async function restoreLocations() {
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: EMAIL, password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const locations = (await (await api.get("/pickupLocations", { headers })).json()).data;
  const seeded = locations.find((location) => !location.label.startsWith("E2E"));
  if (seeded && !seeded.isDefault) await api.put(`/pickupLocations/${seeded._id}`, { data: { isDefault: true }, headers });
  for (const location of locations.filter((l) => l.label.startsWith("E2E"))) {
    await api.delete(`/pickupLocations/${location._id}`, { headers });
  }
  await api.dispose();
}

test.beforeAll(restoreLocations);
test.afterAll(restoreLocations);

test("[US-15] mobile: them dia diem bang goi y quan/huyen, ngoai vung bi chan, dat mac dinh roi xoa", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await expect(page.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("home-login").click();
  await page.getByTestId("login-identity").fill(EMAIL);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("account-pickup-summary")).toHaveText("1/10 địa điểm · mặc định: Địa chỉ mặc định");

  await page.getByTestId("account-pickup-locations").click();
  await expect(page.getByTestId("pl-count")).toHaveText("1/10 địa điểm · shipper đến đây lấy hàng");
  await page.getByTestId("pl-add").click();
  await page.getByTestId("pl-label").fill(LABEL);
  await page.getByTestId("pl-contactName").fill("Khách Hàng 6");
  await page.getByTestId("pl-contactPhone").fill("0909666000");
  await page.getByTestId("pl-address").fill("88 Nguyễn Thị Thập");
  await page.getByTestId("pl-province").fill("TP Hồ Chí Minh");

  // Phuong cua tinh khac -> bao loi ngay; luu thi server cung chan
  await page.getByTestId("pl-ward").fill("Phường Ba Đình");
  await expect(page.getByText('"Phường Ba Đình" không phải xã/phường của TP Hồ Chí Minh — chọn trong gợi ý')).toBeVisible();
  await page.getByTestId("pl-save").click();
  await expect(page.getByTestId("pl-error")).toContainText('"Phường Ba Đình" không thuộc TP Hồ Chí Minh');

  // Go "tan my" -> cham goi y
  await page.getByTestId("pl-ward").fill("tan my");
  await page.getByRole("button", { name: "Chọn Phường Tân Mỹ" }).click();
  await expect(page.getByTestId("pl-ward")).toHaveValue("Phường Tân Mỹ");
  await page.getByTestId("pl-save").click();
  await expect(page.getByText(`Đã thêm "${LABEL}"`)).toBeVisible();
  await expect(page.getByTestId("pl-count")).toHaveText("2/10 địa điểm · shipper đến đây lấy hàng");
  await expect(page.getByText("88 Nguyễn Thị Thập, Phường Tân Mỹ, TP Hồ Chí Minh")).toBeVisible();

  await page.getByRole("button", { name: `Đặt ${LABEL} làm mặc định` }).click();
  await expect(page.getByText(`"${LABEL}" là địa điểm mặc định`)).toBeVisible();
  await expect(page.getByTestId(`pl-item-${LABEL}`)).toContainText("Mặc định");
  await page.screenshot({ path: `${SHOT_DIR}/m10-dia-diem-lay-hang.png` });

  await page.getByRole("button", { name: `Xóa ${LABEL}` }).click();
  await expect(page.getByText(`Đã xóa "${LABEL}"`)).toBeVisible();
  await expect(page.getByTestId(`pl-item-${LABEL}`)).toHaveCount(0);
  await expect(page.getByTestId("pl-item-Địa chỉ mặc định")).toContainText("Mặc định");
});
