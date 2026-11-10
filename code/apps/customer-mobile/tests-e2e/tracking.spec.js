import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-22 tren App Khach hang (ban web, khung dien thoai): tra cuu tu o "Tra cuu van don" o Trang chu, khong
// can dang nhap. Don seed EXP1000000006 (Da giao, 11 moc). Xoa bo dem gioi han 20 lan/phut truoc khi chay.
const SHOT_DIR = "tests-e2e/screenshots";

test.beforeAll(() => {
  try {
    execFileSync("docker", ["exec", "edms-redis", "sh", "-c", "redis-cli --scan --pattern 'ratelimit:tracking:*' | xargs -r redis-cli del"], {
      stdio: "ignore",
    });
  } catch {
    // khong co Docker -> bo qua
  }
});

test("[US-22] mobile: tra cuu tu Trang chu khi chua dang nhap, thay nhom Da giao va 11 moc hanh trinh", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("home-track-code").fill("exp1000000006");
  await page.getByTestId("home-track-submit").click();

  await expect(page.getByTestId("track-group")).toHaveText("Đã giao");
  await expect(page.getByTestId("track-result")).toContainText("EXP1000000006");
  await expect(page.getByTestId("track-result")).toContainText(/09xx xxx \d{3}/);
  await expect(page.getByTestId("track-event-0")).toContainText("Giao thành công");
  await expect(page.getByTestId("track-event-10")).toContainText("Chờ bưu cục xác nhận");
  await page.screenshot({ path: `${SHOT_DIR}/us22-m01-tra-cuu.png`, fullPage: true });

  // Tra ma khac ngay tren man hinh ket qua; ma khong ton tai -> bao loi
  await page.getByTestId("track-code").fill("EXP9999999999");
  await page.getByTestId("track-submit").click();
  await expect(page.getByTestId("track-error")).toContainText("Không tìm thấy đơn EXP9999999999");
  await page.getByTestId("back-button").click();
  await expect(page.getByTestId("home-track-code")).toBeVisible();
});
