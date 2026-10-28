import { test, expect, request } from "@playwright/test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// Kiem thu LIEN THIET BI: App Nhan vien chay that tren may ao Android (Expo Go,
// dieu khien bang Maestro) xen ke voi Web Khach hang tren trinh duyet
// (Playwright), cung mot backend. Moi buoc ben may ao xong la buoc ben web kiem
// tra ngay ket qua.
//
// Chi chay khi bat E2E_MOBILE=1 (can may ao + Metro + adb reverse). Chay qua:
//   code/test-song-song.ps1      (tu chuan bi moi thu roi chay)
const ENABLED = process.env.E2E_MOBILE === "1";
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const MAESTRO = process.env.MAESTRO_BIN || (process.platform === "win32" ? "maestro.bat" : "maestro");
const STAFF_DIR = path.resolve(process.cwd(), "..", "staff");
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
// Go tren may ao bang inputText cua Maestro -> chi dung chu khong dau.
const E2E_PROVINCE = "Tinh Lien Thiet Bi";
const LOCK_TARGET = "khach3@edms.vn";

const execAsync = promisify(exec);

test.describe.configure({ mode: "serial" });
test.skip(!ENABLED, "Can E2E_MOBILE=1 va may ao Android (chay code/test-song-song.ps1)");

// Chay mot flow Maestro tren may ao, nem loi kem 25 dong cuoi neu flow fail.
async function runOnEmulator(flow, env = {}) {
  const envArgs = Object.entries(env).map(([key, value]) => `-e "${key}=${value}"`);
  const command = [`"${MAESTRO}"`, "test", `".maestro/${flow}"`, ...envArgs].join(" ");
  try {
    await execAsync(command, {
      cwd: STAFF_DIR,
      env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: "1" },
      maxBuffer: 32 * 1024 * 1024,
      timeout: 5 * 60 * 1000,
    });
  } catch (err) {
    const output = `${err.stdout || ""}${err.stderr || ""}`.split(/\r?\n/).filter(Boolean).slice(-25).join("\n");
    throw new Error(`Flow Maestro ${flow} that bai:\n${output}`);
  }
}

async function adminApi() {
  const api = await request.newContext({ baseURL: API_URL });
  const loginRes = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await loginRes.json()).data.accessToken}` };
  return { api, headers };
}

// Don dep du nguoi test dung giua chung: xoa khu vuc test, mo khoa tai khoan khach.
async function cleanup() {
  const { api, headers } = await adminApi();
  const areas = await api.get("/serviceAreas", { params: { search: E2E_PROVINCE, limit: 100 }, headers });
  for (const area of (await areas.json()).data) await api.delete(`/serviceAreas/${area._id}`, { headers });
  const users = await api.get("/users", { params: { search: LOCK_TARGET }, headers });
  for (const user of (await users.json()).data) {
    if (user.status !== "ACTIVE") await api.put(`/users/${user._id}`, { data: { status: "ACTIVE" }, headers });
  }
  await api.dispose();
}

test.beforeAll(cleanup);
test.afterAll(cleanup);

async function loginOnWeb(page, email) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Email hoặc số điện thoại").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("may ao: admin them/xoa khu vuc tren App Nhan vien -> khach thay ngay tren web", async ({ browser }) => {
  test.setTimeout(8 * 60 * 1000);
  const district = `Quan Lien Thiet Bi ${Date.now()}`;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // Web: khach (khong dang nhap) tra quan chua ton tai
  await page.goto("/vung-phuc-vu");
  const search = page.getByLabel("Tìm vùng phục vụ");
  await search.fill(district);
  await expect(page.getByRole("status")).toHaveText(`Chưa phục vụ khu vực "${district}"`);

  // May ao: admin them quan do tren App Nhan vien
  await runOnEmulator("cross/admin-them-khu-vuc.yaml", { PROVINCE: E2E_PROVINCE, DISTRICT: district });

  // Web: khach tra lai -> thay ngay
  await search.fill("");
  await search.fill(district);
  await expect(page.getByRole("heading", { name: E2E_PROVINCE })).toBeVisible();
  await expect(page.getByText(district)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/20-thiet-bi-khach-thay-khu-vuc-moi.png` });

  // May ao: admin xoa -> web: khach tra lai thi het
  await runOnEmulator("cross/admin-xoa-khu-vuc.yaml", { DISTRICT: district });
  await search.fill("");
  await search.fill(district);
  await expect(page.getByRole("status")).toHaveText(`Chưa phục vụ khu vực "${district}"`);
  await context.close();
});

test("may ao: admin khoa tai khoan khach -> web tu choi dang nhap; mo khoa -> vao lai duoc", async ({ page }) => {
  test.setTimeout(8 * 60 * 1000);

  // Web: khach dang nhap binh thuong roi dang xuat
  await loginOnWeb(page, LOCK_TARGET);
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();

  // May ao: admin khoa tai khoan
  await runOnEmulator("cross/admin-doi-trang-thai-tai-khoan.yaml", { TARGET_EMAIL: LOCK_TARGET, STATUS: "LOCKED" });

  // Web: dang nhap lai -> server tu choi
  await loginOnWeb(page, LOCK_TARGET);
  await expect(page.getByRole("alert")).toContainText("Tài khoản đã bị quản trị viên khóa");
  await page.screenshot({ path: `${SHOT_DIR}/21-thiet-bi-tai-khoan-bi-khoa.png` });

  // May ao: admin mo khoa -> web: dang nhap duoc
  await runOnEmulator("cross/admin-doi-trang-thai-tai-khoan.yaml", { TARGET_EMAIL: LOCK_TARGET, STATUS: "ACTIVE" });
  await loginOnWeb(page, LOCK_TARGET);
  await expect(page).toHaveURL(/\/$/);
});
