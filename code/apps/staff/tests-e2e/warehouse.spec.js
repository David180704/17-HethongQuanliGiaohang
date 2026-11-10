import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-41 quy trinh lien vai tro, hai kho: shop3 tao don lay o Cau Giay (Hub Ha Noi) giao Quan 1 (Hub Ho Chi Minh)
// -> kho1 duyet; tai xe da lay hang (buoc US-28, ghi thang trang thai) -> kho1 quet ma: nhan vao kho, phan loai
// (bat buoc loai hang), xuat kho -> kho2 (Hub HCM, thiet bi khac) thay don trong "Hang sap toi", nhan tai kho dich
// -> nguoi nhan tra cuu thay "Da den kho giao". Nguoi nhan "E2E KHO ..." - afterAll xoa (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";

let api;
const tokens = {};
let order;

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
async function json(res) {
  const body = await res.json();
  if (!res.ok()) throw new Error(`${res.url()} ${res.status()} ${JSON.stringify(body)}`);
  return body.data;
}

function mongo(script) {
  try {
    execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
  } catch {
    // khong co Docker -> bo qua
  }
}

test.beforeAll(async () => {
  mongo('db.orders.deleteMany({ "receiver.name": /^E2E KHO / })');
  api = await request.newContext({ baseURL: API_URL });
  for (const who of ["kho1", "shop3"]) {
    tokens[who] = (await json(await api.post("/auth/login", { data: { emailOrPhone: `${who}@edms.vn`, password: PASSWORD } }))).accessToken;
  }
  const location = (await json(await api.get("/pickupLocations", { headers: auth("shop3") }))).find((l) => l.isDefault);
  const service = (await json(await api.get("/public/service-types"))).find((s) => s.code === "STANDARD");
  order = await json(
    await api.post("/orders", {
      headers: auth("shop3"),
      data: {
        pickupLocationId: location._id,
        serviceTypeId: service._id,
        receiver: { name: "E2E KHO Nhận", phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
        item: { name: "Tivi 32 inch", weightGram: 6000, length: 80, width: 15, height: 50 },
      },
    }),
  );
  await json(await api.post(`/orders/${order._id}/confirm`, { headers: auth("kho1") }));
  // Buoc lay hang (US-28) da co test rieng: o day dua thang don sang PICKED_UP
  mongo(
    `db.orders.updateOne({ trackingCode: "${order.trackingCode}" }, { $set: { status: "PICKED_UP", assignedTo: null }, ` +
      `$push: { statusHistory: { status: "PICKED_UP", at: new Date(), note: "Đã lấy hàng" } } })`,
  );
});

test.afterAll(async () => {
  await api.dispose();
  mongo('db.orders.deleteMany({ "receiver.name": /^E2E KHO / })');
});

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("[US-41] quy trinh hai kho: Ha Noi nhan, phan loai, xuat kho -> Ho Chi Minh nhan tai kho dich -> nguoi nhan tra cuu", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  const code = order.trackingCode;

  // 1. Kho Ha Noi: don nam trong "Hang sap toi"; quet ma -> nhan vao kho
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Nhập \/ xuất kho/ }).click();
  await expect(page.getByTestId(`wh-in-${code}`)).toContainText("Nhận vào kho");
  await page.getByTestId("wh-code").fill(code.toLowerCase());
  await page.getByTestId("wh-lookup").click();
  await expect(page.getByTestId("wh-result")).toContainText("Kho giao: Hub Hồ Chí Minh");
  await expect(page.getByTestId("wh-action")).toHaveText("Nhận vào kho");
  await page.getByTestId("wh-action").click();
  await expect(page.getByTestId("wh-notice")).toContainText(`${code}: Nhập kho Hub Hà Nội`);

  // Phan loai: bat buoc chon loai hang
  await expect(page.getByTestId("wh-action")).toHaveText("Phân loại");
  await page.getByTestId("wh-action").click();
  await expect(page.getByTestId("wh-error")).toContainText("Chọn loại hàng");
  await page.getByTestId("wh-category-TV").click();
  await page.getByTestId("wh-action").click();
  await expect(page.getByTestId("wh-notice")).toContainText("Phân loại tại Hub Hà Nội: Tivi, chuyển tới Hub Hồ Chí Minh");
  await expect(page.getByTestId(`wh-stock-${code}`)).toContainText("Đã phân loại tại kho · Tivi");
  await page.screenshot({ path: `${SHOT_DIR}/41-kho-phan-loai.png`, fullPage: true });

  // Xuat kho -> kho HN khong con thao tac
  await page.getByTestId("wh-action").click();
  await expect(page.getByTestId("wh-notice")).toContainText("Xuất kho Hub Hà Nội đi Hub Hồ Chí Minh");
  await expect(page.getByTestId("wh-reason")).toContainText("trung chuyển tới kho khác");

  // 2. Kho Ho Chi Minh (thiet bi khac): thay don dang den, bam vao de nhan tai kho dich
  const hcm = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(hcm, "kho2@edms.vn");
  await hcm.getByRole("button", { name: /Nhập \/ xuất kho/ }).click();
  await hcm.getByTestId(`wh-in-${code}`).click();
  await expect(hcm.getByTestId("wh-action")).toHaveText("Nhận tại kho đích");
  await hcm.getByTestId("wh-action").click();
  await expect(hcm.getByTestId("wh-notice")).toContainText(`${code}: Đến kho giao Hub Hồ Chí Minh`);
  await expect(hcm.getByTestId(`wh-stock-${code}`)).toContainText("Đã đến kho giao");
  await hcm.screenshot({ path: `${SHOT_DIR}/41-kho-dich-nhan.png`, fullPage: true });
  await hcm.close();

  // 3. Nguoi nhan tra cuu cong khai
  await expect.poll(async () => (await json(await api.get(`/tracking/${code}`))).statusLabel, { timeout: 10_000 }).toBe("Đã đến kho giao");
});
