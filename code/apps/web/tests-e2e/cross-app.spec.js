import { test, expect, request } from "@playwright/test";

// Kiem thu SONG SONG hai app that cung luc tren cung mot backend:
// nhan vien thao tac tren App Nhan vien (Expo web, cong 8082), khach hang
// thay ket qua ngay tren Web Khach hang (cong 5173). Can ca API (4044),
// "npm run dev" (web) va "npm run web" (apps/staff) dang chay.
const STAFF_URL = process.env.E2E_STAFF_URL || "http://localhost:8082";
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const E2E_PROVINCE = "Tỉnh Liên App";

async function cleanup() {
  const api = await request.newContext({ baseURL: API_URL });
  const loginRes = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await loginRes.json()).data.accessToken}` };
  const list = await api.get("/serviceAreas", { params: { search: E2E_PROVINCE, limit: 100 }, headers });
  for (const area of (await list.json()).data) await api.delete(`/serviceAreas/${area._id}`, { headers });
  await api.dispose();
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

// Web Khach hang cache du lieu 30 giay va tu lam moi moi 30 giay (yeu cau "khong goi
// API lien tuc") -> khach thay thay doi cua admin TOI DA sau 30 giay, khong phai ngay.
test("admin them vung phuc vu tren App Nhan vien -> khach thay tren Web trong vong 30 giay", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const district = `Quận Liên App ${Date.now()}`;

  // Hai "thiet bi" doc lap: nhan vien (may tinh) va khach hang (dien thoai)
  const staffContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staff = await staffContext.newPage();
  const customer = await customerContext.newPage();
  staff.on("dialog", (dialog) => dialog.accept());

  // Khach mo trang vung phuc vu, tim quan chua ton tai
  await customer.goto("/vung-phuc-vu");
  await customer.getByLabel("Tìm vùng phục vụ").fill(district);
  await expect(customer.getByRole("status")).toHaveText(`Chưa phục vụ khu vực "${district}"`);

  // Nhan vien dang nhap App Nhan vien va them quan do
  await staff.goto(STAFF_URL);
  await staff.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin@edms.vn");
  await staff.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await staff.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await staff.getByRole("button", { name: "Khu vực phục vụ", exact: true }).click();
  await staff.getByRole("button", { name: "+ Thêm mới" }).click();
  await staff.getByLabel("Tỉnh/Thành phố", { exact: true }).fill(E2E_PROVINCE);
  await staff.getByLabel("Quận/Huyện", { exact: true }).fill(district);
  await staff.getByRole("radio", { name: "Miền Nam" }).click();
  await staff.getByRole("radio", { name: /R-HCM-NOI/ }).click();
  await staff.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(staff.getByText("Đã thêm mới")).toBeVisible();

  // Khach tim lai (khong dang nhap) -> thay ngay quan vua them
  await customer.getByLabel("Tìm vùng phục vụ").fill("");
  await customer.getByLabel("Tìm vùng phục vụ").fill(district);
  await expect(customer.getByRole("heading", { name: E2E_PROVINCE })).toBeVisible({ timeout: 40_000 });
  await expect(customer.getByText(district)).toBeVisible();
  await staff.screenshot({ path: `${SHOT_DIR}/10-cross-app-staff.png` });
  await customer.screenshot({ path: `${SHOT_DIR}/10-cross-app-customer.png` });

  // Nhan vien xoa -> khach tim lai thi het
  await staff.getByPlaceholder("Tìm theo tỉnh, quận/huyện...").fill(district);
  await staff.getByRole("button", { name: `Xóa ${district}` }).click();
  await expect(staff.getByText(`Đã xóa "${district}"`)).toBeVisible();
  await customer.getByLabel("Tìm vùng phục vụ").fill("");
  await customer.getByLabel("Tìm vùng phục vụ").fill(district);
  await expect(customer.getByRole("status")).toHaveText(`Chưa phục vụ khu vực "${district}"`, { timeout: 40_000 });

  await staffContext.close();
  await customerContext.close();
});
