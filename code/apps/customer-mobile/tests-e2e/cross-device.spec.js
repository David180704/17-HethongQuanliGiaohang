import { test, expect, request } from "@playwright/test";
import { exec } from "node:child_process";
import { promisify } from "node:util";

// Kiem thu LIEN THIET BI nhu giao dich that: NHAN VIEN thao tac tren App Nhan vien (trinh duyet
// may tinh, Playwright) - KHACH thao tac tren App Khach hang chay that tren may ao Android
// (Expo Go, Maestro). Cung mot backend; buoc ben nay xong thi ben kia kiem tra ngay.
//
// Chi chay khi E2E_MOBILE=1 (can may ao + Metro 8082/8083 + adb reverse) - code/test-song-song.ps1.
const ENABLED = process.env.E2E_MOBILE === "1";
const STAFF_URL = process.env.E2E_STAFF_URL || "http://localhost:8082";
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const MAESTRO = process.env.MAESTRO_BIN || (process.platform === "win32" ? "maestro.bat" : "maestro");
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const LOCK_TARGET = "khach4@edms.vn";
const LOCK_TARGET_NAME = "Khách Hàng 4";
// Go tren may ao bang inputText cua Maestro -> chi chu khong dau.
const E2E_PROVINCE = "Tinh Lien Thiet Bi KH";

const execAsync = promisify(exec);

test.describe.configure({ mode: "serial" });
test.skip(!ENABLED, "Can E2E_MOBILE=1 va may ao Android (chay code/test-song-song.ps1)");

// Chay mot flow Maestro cua App Khach hang tren may ao (cwd = apps/customer-mobile).
async function runOnEmulator(flow, env = {}) {
  const envArgs = Object.entries(env).map(([key, value]) => `-e "${key}=${value}"`);
  const command = [`"${MAESTRO}"`, "test", `".maestro/${flow}"`, ...envArgs].join(" ");
  try {
    await execAsync(command, {
      cwd: process.cwd(),
      env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: "1" },
      maxBuffer: 32 * 1024 * 1024,
      timeout: 5 * 60 * 1000,
    });
  } catch (err) {
    const output = `${err.stdout || ""}${err.stderr || ""}`.split(/\r?\n/).filter(Boolean).slice(-25).join("\n");
    throw new Error(`Flow Maestro ${flow} that bai:\n${output}`);
  }
}

// Don dep du test dung giua chung: mo khoa tai khoan khach, xoa khu vuc test.
async function cleanup() {
  const api = await request.newContext({ baseURL: API_URL });
  const loginRes = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await loginRes.json()).data.accessToken}` };
  const users = await api.get("/users", { params: { search: LOCK_TARGET }, headers });
  for (const user of (await users.json()).data) {
    if (user.status !== "ACTIVE") await api.put(`/users/${user._id}`, { data: { status: "ACTIVE" }, headers });
  }
  const areas = await api.get("/serviceAreas", { params: { search: E2E_PROVINCE, limit: 100 }, headers });
  for (const area of (await areas.json()).data) await api.delete(`/serviceAreas/${area._id}`, { headers });
  await api.dispose();
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

// Nhan vien: dang nhap App Nhan vien tren trinh duyet (man hinh may tinh)
async function openStaffAsAdmin(browser) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(STAFF_URL);
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin@edms.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Admin EDMS")).toBeVisible();
  return { context, page };
}

async function setUserStatus(page, status) {
  await page.getByTestId("search-input").fill(LOCK_TARGET);
  await expect(page.getByText(/Tổng 1 bản ghi/)).toBeVisible();
  await page.getByRole("button", { name: `Sửa ${LOCK_TARGET_NAME}` }).click();
  await page.getByTestId(`field-status-${status}`).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi")).toBeVisible();
}

test("nhan vien khoa tai khoan tren App Nhan vien -> khach tren dien thoai bi chan; mo khoa -> vao lai duoc", async ({
  browser,
}) => {
  test.setTimeout(8 * 60 * 1000);
  const { context, page } = await openStaffAsAdmin(browser);
  await page.getByRole("button", { name: "Người dùng", exact: true }).click();

  // Nhan vien khoa -> khach dang nhap tren may ao bi tu choi
  await setUserStatus(page, "LOCKED");
  await page.screenshot({ path: `${SHOT_DIR}/x-nv-khoa-tai-khoan.png` });
  await runOnEmulator("cross/khach-dang-nhap.yaml", { USER_EMAIL: LOCK_TARGET, EXPECT: "locked" });

  // Nhan vien mo khoa -> khach dang nhap lai duoc
  await setUserStatus(page, "ACTIVE");
  await runOnEmulator("cross/khach-dang-nhap.yaml", { USER_EMAIL: LOCK_TARGET, EXPECT: "ok" });
  await context.close();
});

test("nhan vien them khu vuc tren App Nhan vien -> khach tim thay tren dien thoai; xoa -> het", async ({ browser }) => {
  test.setTimeout(8 * 60 * 1000);
  const district = `Quan KH ${String(Date.now()).slice(-6)}`;
  const { context, page } = await openStaffAsAdmin(browser);
  await page.getByRole("button", { name: "Khu vực phục vụ", exact: true }).click();

  // Khach tim truoc: chua co
  await runOnEmulator("cross/khach-tim-khu-vuc.yaml", { SEARCH: district, FOUND: "false" });

  // Nhan vien them quan moi
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.getByLabel("Tỉnh/Thành phố", { exact: true }).fill(E2E_PROVINCE);
  await page.getByLabel("Quận/Huyện", { exact: true }).fill(district);
  await page.getByRole("radio", { name: "Miền Bắc" }).click();
  await page.getByRole("radio", { name: /R-HN-NOI/ }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã thêm mới")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/x-nv-them-khu-vuc.png` });

  // Khach tim lai tren dien thoai: thay ngay (tu khoa moi khong co trong cache)
  await runOnEmulator("cross/khach-tim-khu-vuc.yaml", { SEARCH: district, FOUND: "true" });

  // Nhan vien xoa -> khach tim lai thi het
  await page.getByPlaceholder("Tìm theo tỉnh, quận/huyện...").fill(district);
  await expect(page.getByText(/Tổng 1 bản ghi/)).toBeVisible();
  await page.getByRole("button", { name: `Xóa ${district}` }).click();
  await expect(page.getByText(`Đã xóa "${district}"`)).toBeVisible();
  await runOnEmulator("cross/khach-tim-khu-vuc.yaml", { SEARCH: district, FOUND: "false" });
  await context.close();
});
