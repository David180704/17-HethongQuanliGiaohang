import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-25 + US-27 quy trinh lien vai tro (worker phan cong tu dong chay trong API that):
//   shop3 tao 2 don lay hang o Da Nang (tuyen R-DN-NOI, buu cuc PO-DN truc thuoc Hub Ha Noi) -> kho1 duyet
//   -> he thong tu phan cong cho Tai Xe 4 dang trong ca (nang luc dat 1 don/ca) -> don thu 2 vao hang cho
//   "da du nang luc" -> kho1 phan cong tay cho Tai Xe 4 (bat buoc ly do, canh bao vuot nang luc)
//   -> Tai Xe 4 dang nhap thay 2 don can lay voi dia chi, lien he; shop thay "Da phan cong lay hang".
// Dung tuyen Da Nang de ca thu nghiem (mo ca ngay) khong phan cong nham don cua bo test khac (lay hang o
// Ha Noi) khi chay song song. Du lieu thu: nguoi nhan va dia diem "E2E PC ...", ca "KT25 ..." - afterAll xoa.
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

let api;
const tokens = {};
let driver;
let original;
let location;
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
      "db.orders.deleteMany({ _id: { $in: ids } }); db.shifts.deleteMany({ name: /^KT25 / });" +
      "db.pickuplocations.deleteMany({ label: /^E2E PC / });",
  );

test.beforeAll(async () => {
  removeTestData();
  api = await request.newContext({ baseURL: API_URL });
  for (const who of ["admin", "kho1", "shop3"]) {
    tokens[who] = (await json(await api.post("/auth/login", { data: { emailOrPhone: `${who}@edms.vn`, password: PASSWORD } }))).accessToken;
  }
  // Ca ca ngay hom nay tren R-DN-NOI cho Tai Xe 4; nang luc lay rieng 1 don/ca
  const options = await json(await api.get("/shifts/options", { headers: auth("kho1") }));
  const route = options.routes.find((r) => r.code === "R-DN-NOI");
  driver = route.shippers.find((s) => s.fullName === "Tài Xế 4");
  const capacity = await json(await api.get("/capacity", { headers: auth("kho1") }));
  original = capacity.routes.find((r) => r.code === "R-DN-NOI").shippers.find((s) => s._id === driver._id).maxPickupPerShift;
  await json(
    await api.post("/shifts", {
      headers: auth("kho1"),
      data: { routeId: route._id, name: "KT25 Ca kiểm thử", shiftDate: today(), startTime: "00:00", endTime: "23:59", shipperIds: [driver._id] },
    }),
  );
  await json(await api.put(`/capacity/shippers/${driver._id}`, { headers: auth("kho1"), data: { maxPickupPerShift: 1 } }));
  location = await json(
    await api.post("/pickupLocations", {
      headers: auth("shop3"),
      data: {
        label: "E2E PC Kho Đà Nẵng", contactName: "Chủ Shop 3", contactPhone: "0900000043", address: "10 Bạch Đằng",
        province: "Đà Nẵng", district: "Hải Châu", ward: "Thạch Thang",
      },
    }),
  );
});

test.afterAll(async () => {
  await api.put(`/capacity/shippers/${driver._id}`, { headers: auth("admin"), data: { maxPickupPerShift: original ?? null } });
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
  // 1. Shop tao 2 don, kho duyet tung don (worker tu phan cong ngay sau moi lan duyet)
  const service = (await json(await api.get("/public/service-types"))).find((s) => s.code === "STANDARD");
  for (let i = 1; i <= 2; i += 1) {
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
    // Doi worker xu ly xong (don 1 duoc phan cong, don 2 vao hang cho kem ly do) roi moi sang buoc sau
    await expect
      .poll(async () => {
        const seen = await json(await api.get(`/orders/${order._id}`, { headers: auth("kho1") }));
        return seen.status === "PICKUP_ASSIGNED" || Boolean(seen.unassignedReason);
      }, { timeout: 15_000 })
      .toBe(true);
  }
  const [o1, o2] = orders.map((o) => o.trackingCode);

  // 2. Kho mo bang phan cong: don 1 da co nguoi, don 2 trong hang cho vi ca da day
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /^Phân công/ }).click();
  await expect(page.getByRole("heading", { name: "Phân công" })).toBeVisible();
  const queued = page.getByTestId(`assign-queue-${o2}`);
  await expect(queued).toContainText("Tuyến R-DN-NOI: người trực ca đã đủ năng lực");
  await expect(page.getByTestId(`assign-done-${o1}`)).toContainText("Tài Xế 4");
  const shiftCard = page.locator('[data-testid^="assign-shift-R-DN-NOI-"]').filter({ hasText: "KT25 Ca kiểm thử" });
  await expect(shiftCard).toContainText("Tài Xế 4: 1/1 đơn · 1 chưa lấy");

  // 3. Phan cong tay, bat buoc ly do; duoc vuot nang luc kem canh bao
  await queued.getByRole("button", { name: `Phân công tay ${o2}` }).click();
  await page.getByTestId(`assign-shipper-${driver._id}`).click();
  await page.getByTestId("assign-save").click();
  await expect(page.getByTestId("assign-error")).toContainText("phải ghi lý do");
  await page.getByTestId("assign-reason").fill("Đơn ưu tiên, Tài Xế 4 tiện đường");
  await page.getByTestId("assign-save").click();
  await expect(page.getByTestId("assign-notice")).toContainText(`Đã giao ${o2} cho Tài Xế 4`);
  await expect(page.getByTestId("assign-warning")).toContainText("vượt năng lực ca (2/1 đơn)");
  await expect(page.getByTestId(`assign-done-${o2}`)).toContainText("Tài Xế 4");
  await expect(shiftCard).toContainText("Tài Xế 4: 2/1 đơn · 2 chưa lấy");
  await page.screenshot({ path: `${SHOT_DIR}/25-phan-cong.png`, fullPage: true });

  // 4. Tai Xe 4 (dien thoai khac) thay 2 don can lay trong ca hien tai
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(phone, "taixe4@edms.vn");
  await expect(phone.getByTestId("shipper-to-pick")).toHaveText("2");
  await phone.getByRole("button", { name: /Đơn cần lấy/ }).click();
  await expect(phone.getByTestId("pickup-counts")).toContainText("Cần lấy: 2");
  await expect(phone.getByTestId(`pickup-${o1}`)).toContainText("10 Bạch Đằng, Thạch Thang, Hải Châu, Đà Nẵng");
  await expect(phone.getByTestId(`pickup-${o1}`)).toContainText("Liên hệ: Chủ Shop 3 · 0900000043");
  await expect(phone.getByTestId(`pickup-${o2}`)).toContainText("Kho điều chỉnh");
  await phone.screenshot({ path: `${SHOT_DIR}/27-don-can-lay.png`, fullPage: true });
  await phone.close();

  // 5. Shop thay trang thai moi cua don
  const seen = await json(await api.get(`/orders/${orders[1]._id}`, { headers: auth("shop3") }));
  expect(seen.display.statusLabel).toBe("Đã phân công lấy hàng");
});
