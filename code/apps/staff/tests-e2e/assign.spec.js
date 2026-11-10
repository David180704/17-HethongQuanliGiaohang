import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-25 + US-27 quy trinh lien vai tro (worker phan cong tu dong chay trong API that):
//   shop3 tao 3 don (lay hang Cau Giay - tuyen R-HN-NOI) -> kho1 duyet -> he thong tu phan cong cho nguoi
//   trong ca (Tai Xe 1, Tai Xe 5, nang luc dat 1 don/ca) -> don thu 3 vao hang cho "da du nang luc"
//   -> kho1 phan cong tay cho Tai Xe 5 (bat buoc ly do, canh bao vuot nang luc)
//   -> Tai Xe 5 dang nhap thay 2 don can lay voi dia chi, lien he; shop thay "Da phan cong lay hang".
// Du lieu thu: nguoi nhan "E2E PC ...", ca "KT25 ..." - afterAll xoa (CSDL local, e2e-guard da kiem).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

let api;
const tokens = {};
let drivers = {};
let original = {};
const orders = [];

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

const removeTestData = () =>
  mongo(
    'const ids = db.orders.find({ "receiver.name": /^E2E PC / }).toArray().map((o) => o._id);' +
      "db.assignments.deleteMany({ orderId: { $in: ids } });" +
      'db.orders.deleteMany({ _id: { $in: ids } }); db.shifts.deleteMany({ name: /^KT25 / });',
  );

test.beforeAll(async () => {
  removeTestData();
  api = await request.newContext({ baseURL: API_URL });
  for (const who of ["admin", "kho1", "shop3"]) {
    tokens[who] = (await json(await api.post("/auth/login", { data: { emailOrPhone: `${who}@edms.vn`, password: PASSWORD } }))).accessToken;
  }
  // Ca ca ngay hom nay tren R-HN-NOI cho Tai Xe 1 va Tai Xe 5; nang luc lay rieng 1 don/ca
  const options = await json(await api.get("/shifts/options", { headers: auth("kho1") }));
  const route = options.routes.find((r) => r.code === "R-HN-NOI");
  drivers = Object.fromEntries(route.shippers.filter((s) => ["Tài Xế 1", "Tài Xế 5"].includes(s.fullName)).map((s) => [s.fullName, s]));
  const capacity = await json(await api.get("/capacity", { headers: auth("kho1") }));
  for (const s of capacity.routes.find((r) => r.code === "R-HN-NOI").shippers) original[s._id] = s.maxPickupPerShift;
  await json(
    await api.post("/shifts", {
      headers: auth("kho1"),
      data: {
        routeId: route._id,
        name: "KT25 Ca kiểm thử",
        shiftDate: today(),
        startTime: "00:00",
        endTime: "23:59",
        shipperIds: Object.values(drivers).map((d) => d._id),
      },
    }),
  );
  for (const d of Object.values(drivers)) {
    await json(await api.put(`/capacity/shippers/${d._id}`, { headers: auth("kho1"), data: { maxPickupPerShift: 1 } }));
  }
});

test.afterAll(async () => {
  for (const d of Object.values(drivers)) {
    await api.put(`/capacity/shippers/${d._id}`, { headers: auth("admin"), data: { maxPickupPerShift: original[d._id] ?? null } });
  }
  await api.dispose();
  removeTestData();
});

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("[US-25][US-27] quy trinh: shop tao don -> kho duyet -> tu phan cong theo ca/nang luc -> kho phan cong tay co ly do -> tai xe thay don can lay", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  // 1. Shop tao 3 don, kho duyet tung don (worker tu phan cong ngay sau moi lan duyet)
  const [location] = await json(await api.get("/pickupLocations", { headers: auth("shop3") }));
  const service = (await json(await api.get("/public/service-types"))).find((s) => s.code === "STANDARD");
  for (let i = 1; i <= 3; i += 1) {
    const order = await json(
      await api.post("/orders", {
        headers: auth("shop3"),
        data: {
          pickupLocationId: location._id,
          serviceTypeId: service._id,
          receiver: { name: `E2E PC Nhận ${i}`, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
          item: { name: `Hàng phân công ${i}`, weightGram: 600, length: 20, width: 15, height: 10 },
        },
      }),
    );
    await json(await api.post(`/orders/${order._id}/confirm`, { headers: auth("kho1") }));
    orders.push(order);
    // Doi worker xu ly xong don nay roi moi duyet don sau (giu dung thu tu de kiem tra)
    await expect
      .poll(async () => (await json(await api.get(`/orders/${order._id}`, { headers: auth("shop3") }))).status !== "CONFIRMED" || i === 3, { timeout: 15_000 })
      .toBe(true);
  }
  const [o1, o2, o3] = orders.map((o) => o.trackingCode);

  // 2. Kho mo bang phan cong: 2 don da co nguoi, don thu 3 trong hang cho vi ca da day
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Phân công lấy hàng/ }).click();
  await expect(page.getByRole("heading", { name: "Phân công lấy hàng" })).toBeVisible();
  const queued = page.getByTestId(`assign-queue-${o3}`);
  await expect(queued).toContainText("người trực ca đã đủ năng lực", { timeout: 15_000 });
  await expect(page.getByTestId(`assign-done-${o1}`)).toContainText("Tài Xế 1");
  await expect(page.getByTestId(`assign-done-${o2}`)).toContainText("Tài Xế 5");
  const shiftCard = page.locator('[data-testid^="assign-shift-R-HN-NOI-"]').filter({ hasText: "KT25 Ca kiểm thử" });
  await expect(shiftCard).toContainText("Tài Xế 1: 1/1 đơn");
  await expect(shiftCard).toContainText("Tài Xế 5: 1/1 đơn");

  // 3. Chay lai tu dong khong giup duoc (van day) -> phan cong tay, bat buoc ly do
  await page.getByTestId("assign-run").click();
  await expect(page.getByTestId("assign-notice")).toContainText("0 đơn đã có người");
  await queued.getByRole("button", { name: `Phân công tay ${o3}` }).click();
  await page.getByTestId(`assign-shipper-${drivers["Tài Xế 5"]._id}`).click();
  await page.getByTestId("assign-save").click();
  await expect(page.getByTestId("assign-error")).toContainText("phải ghi lý do");
  await page.getByTestId("assign-reason").fill("Đơn ưu tiên, Tài Xế 5 tiện đường");
  await page.getByTestId("assign-save").click();
  await expect(page.getByTestId("assign-notice")).toContainText(`Đã giao ${o3} cho Tài Xế 5`);
  await expect(page.getByTestId("assign-warning")).toContainText("vượt năng lực ca (2/1 đơn)");
  await expect(page.getByTestId(`assign-done-${o3}`)).toContainText("Tài Xế 5");
  await page.screenshot({ path: `${SHOT_DIR}/25-phan-cong.png`, fullPage: true });

  // 4. Tai Xe 5 (dien thoai khac) thay 2 don can lay trong ca hien tai
  const driver = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(driver, "taixe5@edms.vn");
  await expect(driver.getByTestId("shipper-to-pick")).toHaveText("2");
  await driver.getByRole("button", { name: /Đơn cần lấy/ }).click();
  await expect(driver.getByTestId("pickup-counts")).toContainText("Cần lấy: 2");
  await expect(driver.getByTestId(`pickup-${o2}`)).toContainText("Cầu Giấy");
  await expect(driver.getByTestId(`pickup-${o3}`)).toContainText("Kho điều chỉnh");
  await expect(driver.getByTestId(`pickup-${o1}`)).toHaveCount(0);
  await driver.screenshot({ path: `${SHOT_DIR}/27-don-can-lay.png`, fullPage: true });
  await driver.close();

  // 5. Shop thay trang thai moi cua don
  const seen = await json(await api.get(`/orders/${orders[2]._id}`, { headers: auth("shop3") }));
  expect(seen.display.statusLabel).toBe("Đã phân công lấy hàng");
});
