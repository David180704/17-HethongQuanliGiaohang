import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Sprint 7 (de 02) tren App Khach hang (khung dien thoai): shop bao su co tu chi tiet don, theo doi tinh trang
// (US-38) va xem doi soat (US-43). Don "E2E SC M ..." cua Shop 1 xoa o afterAll.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
let order;

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "pipe" });
}
const removeTestData = () =>
  mongo('const ids = db.orders.find({ "receiver.name": /^E2E SC M / }).toArray().map((o) => o._id); db.incidents.deleteMany({ orderId: { $in: ids } }); db.orders.deleteMany({ _id: { $in: ids } });');

test.beforeAll(async () => {
  removeTestData();
  const api = await request.newContext({ baseURL: API_URL });
  const token = (await (await api.post("/auth/login", { data: { emailOrPhone: "shop1@edms.vn", password: PASSWORD } })).json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const location = (await (await api.get("/pickupLocations", { headers })).json()).data.find((l) => l.isDefault);
  const standard = (await (await api.get("/public/service-types")).json()).data.find((s) => s.code === "STANDARD");
  const res = await api.post("/orders", {
    headers,
    data: {
      pickupLocationId: location._id,
      serviceTypeId: standard._id,
      receiver: { name: "E2E SC M Nhận", phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
      item: { name: "Bình hoa gốm", weightGram: 1500, length: 30, width: 30, height: 40 },
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  order = (await res.json()).data;
  await api.dispose();
});

test.afterAll(removeTestData);

test("[US-38][US-43] mobile: shop bao su co tu chi tiet don, thay tinh trang xu ly; xem doi soat", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("home-login").click();
  await page.getByTestId("login-identity").fill("shop1@edms.vn");
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("account-orders").click();
  await page.getByTestId("orders-search").fill(order.trackingCode);
  await page.getByTestId("orders-search-submit").click();
  await page.getByTestId(`order-${order.trackingCode}`).click();

  await expect(page.getByTestId("order-incidents")).toContainText("Chưa có sự cố nào với đơn này.");
  await page.getByTestId("incident-open").click();
  await page.getByTestId("incident-submit").click();
  await expect(page.getByTestId("incident-error")).toContainText("Chọn loại sự cố");
  await page.getByTestId("incident-type-DAMAGED").click();
  await page.getByTestId("incident-description").fill("Muốn kiểm tra lại đóng gói bình gốm trước khi giao");
  await page.getByTestId("incident-submit").click();
  await expect(page.getByTestId("incident-message")).toContainText("Đã gửi SC");
  await expect(page.getByTestId("order-incidents")).toContainText("Hư hỏng hàng hóa · Mới ghi nhận");
  await expect(page.getByTestId("order-detail-status")).toContainText("Đang xử lý sự cố");
  await page.screenshot({ path: `${SHOT_DIR}/m38-bao-su-co.png`, fullPage: true });

  // Quay ve tai khoan -> Doi soat
  await page.getByRole("button", { name: /Quay lại/ }).first().click();
  await page.getByRole("button", { name: /Quay lại/ }).first().click();
  await page.getByTestId("account-settlements").click();
  await expect(page.getByText("Thu hộ, phí, điều chỉnh và tiền thực nhận")).toBeVisible();
});
