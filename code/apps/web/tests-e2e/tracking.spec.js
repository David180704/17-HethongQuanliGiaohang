import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-22 tren Web Khach hang: khach vang lai (khong dang nhap) tra cuu bang ma van don, thay 4 nhom trang
// thai cua de 14 va cac moc hanh trinh; so dien thoai bi che. Dung don seed khong flow nao doi trang thai:
// EXP1000000006 (Da giao, 11 moc), EXP1000000004 (Dang giao). API gioi han 20 lan/phut moi IP va moi test
// cung chay tu may nay -> xoa bo dem truoc khi chay (CSDL/Redis local, e2e-guard da kiem).
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

test("[US-22] khach vang lai tra cuu ma van don: 4 nhom trang thai, hanh trinh moi nhat o tren, so dien thoai bi che", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Điều hướng chính", exact: true }).getByRole("link", { name: "Tra cứu" }).click();
  await expect(page.getByRole("heading", { name: "Tra cứu đơn hàng" })).toBeVisible();

  await page.getByLabel("Mã vận đơn").fill("exp1000000006");
  await page.getByRole("button", { name: "Tra cứu", exact: true }).click();
  await expect(page).toHaveURL(/\/tra-cuu\?ma=EXP1000000006$/);
  const result = page.getByRole("region", { name: "Kết quả tra cứu" });
  await expect(result).toContainText("EXP1000000006");
  const stages = result.getByRole("list", { name: "Trạng thái đơn" });
  await expect(stages.getByRole("listitem")).toHaveText(["Chưa nhận", "Đã nhận – Chưa giao", "Đã nhận – Đang giao", "Đã giao"]);
  await expect(stages.locator('[aria-current="step"]')).toHaveText("Đã giao");
  const journey = result.getByRole("list", { name: "Hành trình" }).getByRole("listitem");
  await expect(journey).toHaveCount(11);
  await expect(journey.first()).toContainText("Giao thành công");
  await expect(journey.last()).toContainText("Chờ bưu cục xác nhận");
  await expect(result).toContainText(/09xx xxx \d{3}/);
  await expect(result).not.toContainText(/0\d{9}/);
  await page.screenshot({ path: `${SHOT_DIR}/us22-01-tra-cuu.png`, fullPage: true });

  // Gui link cho nguoi nhan: mo thang URL co ma
  await page.goto("/tra-cuu?ma=EXP1000000004");
  await expect(page.getByRole("list", { name: "Trạng thái đơn" }).locator('[aria-current="step"]')).toHaveText("Đã nhận – Đang giao");
  await expect(page.getByRole("region", { name: "Kết quả tra cứu" })).toContainText("Đang giao hàng");
});

test("[US-22] ma sai dinh dang hoac khong ton tai: bao loi ro rang", async ({ page }) => {
  await page.goto("/tra-cuu");
  await page.getByLabel("Mã vận đơn").fill("ABC123");
  await page.getByRole("button", { name: "Tra cứu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Mã vận đơn gồm EXP và 10 chữ số");
  await page.getByLabel("Mã vận đơn").fill("EXP9999999999");
  await page.getByRole("button", { name: "Tra cứu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Không tìm thấy đơn EXP9999999999");
});
