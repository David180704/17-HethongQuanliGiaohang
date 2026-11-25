import { test, expect, request } from "@playwright/test";

// US-15: dia diem lay hang tren Web Khach hang. Chi file nay dung khach5@edms.vn
// (cac bo test khac dung khach1-4) nen chay song song khong de du lieu cua nhau.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const EMAIL = "khach5@edms.vn";
const SHOT_DIR = "tests-e2e/screenshots";
const LABEL = "E2E Kho Cầu Giấy";

// Xoa dia diem do test tao (nhan "E2E ...") va tra mac dinh ve dia diem cua seed
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

test("[US-15] khach them dia diem lay hang: ngoai vung phuc vu bi chan, dat mac dinh, xoa thi mac dinh tra ve dia diem cu", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/dang-nhap?next=%2Ftai-khoan");
  await page.getByLabel("Email hoặc số điện thoại").fill(EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("1/10 địa điểm · mặc định: Địa chỉ mặc định")).toBeVisible();

  await page.getByRole("link", { name: "Quản lý địa điểm" }).click();
  await expect(page.getByRole("heading", { name: "Địa điểm lấy hàng" })).toBeVisible();
  await expect(page.getByText("1/10 địa điểm · shipper đến đây lấy hàng")).toBeVisible();

  await page.getByRole("button", { name: "+ Thêm địa điểm" }).click();
  const form = page.getByRole("form", { name: "Thêm địa điểm lấy hàng" });
  await form.getByLabel("Tên gợi nhớ").fill(LABEL);
  await form.getByLabel("Người liên hệ").fill("Khách Hàng 5");
  await form.getByLabel("Số điện thoại liên hệ").fill("0909 555 000");
  await form.getByLabel("Địa chỉ (số nhà, đường)").fill("12 Trần Thái Tông");
  await form.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  // Phuong cua tinh khac -> bao loi ngay tren o nhap, form khong gui duoc
  await form.getByLabel("Xã/Phường").fill("Phường Bến Thành");
  await expect(form.locator("#pl-ward-error")).toContainText('"Phường Bến Thành" không phải xã/phường của Hà Nội');
  await form.getByRole("button", { name: "Lưu địa điểm" }).click();
  await expect(page.getByText(`Đã thêm "${LABEL}"`)).toHaveCount(0);

  // Go khong dau, thieu chu "Phường": tu khop ten chuan "Phường Cầu Giấy"
  await form.getByLabel("Xã/Phường").fill("cau giay");
  await form.getByRole("button", { name: "Lưu địa điểm" }).click();
  await expect(page.getByText(`Đã thêm "${LABEL}"`)).toBeVisible();
  await expect(page.getByText("12 Trần Thái Tông, Phường Cầu Giấy, Hà Nội")).toBeVisible();
  await expect(page.getByText("2/10 địa điểm · shipper đến đây lấy hàng")).toBeVisible();

  await page.getByRole("button", { name: `Đặt ${LABEL} làm mặc định` }).click();
  await expect(page.getByText(`"${LABEL}" là địa điểm mặc định`)).toBeVisible();
  const items = page.getByRole("listitem");
  await expect(items.first()).toContainText(LABEL);
  await expect(items.first()).toContainText("Mặc định");
  await page.screenshot({ path: `${SHOT_DIR}/10-pickup-locations.png`, fullPage: true });

  await page.getByRole("button", { name: `Xóa ${LABEL}` }).click();
  await expect(page.getByText(`Đã xóa "${LABEL}"`)).toBeVisible();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Địa chỉ mặc định");
  await expect(items.first()).toContainText("Mặc định");
});
