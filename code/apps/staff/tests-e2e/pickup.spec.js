import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-28 quy trinh lien vai tro: shop3 co 2 don lay o Da Nang (R-DN-NOI) -> kho1 duyet -> tu phan cong cho Tai Xe 4
// (ca "KT28 ..." ca ngay) -> Tai Xe 4 quet ma lay don 1 (nhap sai ma bi chan), don 2 ghi "Khong lay duoc" (bat buoc
// nguyen nhan) -> kho1 thay don 2 o muc "Lay khong duoc" kem nguyen nhan, giao lai -> nguoi nhan don 1 tra cuu thay
// "Da lay hang". Du lieu thu: nguoi nhan / dia diem "E2E LH ...", ca "KT28 ..." - afterAll xoa (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

let api;
const tokens = {};
let driver;
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
    'const ids = db.orders.find({ "receiver.name": /^E2E LH / }).toArray().map((o) => o._id);' +
      "db.assignments.deleteMany({ orderId: { $in: ids } });" +
      "db.orders.deleteMany({ _id: { $in: ids } }); db.shifts.deleteMany({ name: /^KT28 / });" +
      "db.pickuplocations.deleteMany({ label: /^E2E LH / });",
  );

test.beforeAll(async () => {
  removeTestData();
  api = await request.newContext({ baseURL: API_URL });
  for (const who of ["kho1", "shop3"]) {
    tokens[who] = (await json(await api.post("/auth/login", { data: { emailOrPhone: `${who}@edms.vn`, password: PASSWORD } }))).accessToken;
  }
  const options = await json(await api.get("/shifts/options", { headers: auth("kho1") }));
  const route = options.routes.find((r) => r.code === "R-DN-NOI");
  driver = route.shippers.find((s) => s.fullName === "Tài Xế 4");
  await json(
    await api.post("/shifts", {
      headers: auth("kho1"),
      data: { routeId: route._id, name: "KT28 Ca lấy hàng", shiftDate: today(), startTime: "00:01", endTime: "23:59", shipperIds: [driver._id] },
    }),
  );
  location = await json(
    await api.post("/pickupLocations", {
      headers: auth("shop3"),
      data: {
        label: "E2E LH Kho Đà Nẵng", contactName: "Chủ Shop 3", contactPhone: "0900000043", address: "12 Bạch Đằng",
        province: "Đà Nẵng", district: "Hải Châu", ward: "Thạch Thang",
      },
    }),
  );
  const service = (await json(await api.get("/public/service-types"))).find((s) => s.code === "STANDARD");
  for (let i = 1; i <= 2; i += 1) {
    const order = await json(
      await api.post("/orders", {
        headers: auth("shop3"),
        data: {
          pickupLocationId: location._id,
          serviceTypeId: service._id,
          receiver: { name: `E2E LH Nhận ${i}`, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
          item: { name: `Hàng lấy ${i}`, weightGram: 600, length: 20, width: 15, height: 10 },
        },
      }),
    );
    await json(await api.post(`/orders/${order._id}/confirm`, { headers: auth("kho1") }));
    orders.push(order);
  }
  // Worker trong API tu phan cong -> doi ca 2 don sang PICKUP_ASSIGNED
  for (const order of orders) {
    await expect
      .poll(async () => (await json(await api.get(`/orders/${order._id}`, { headers: auth("shop3") }))).status, { timeout: 15_000 })
      .toBe("PICKUP_ASSIGNED");
  }
});

test.afterAll(async () => {
  await api.dispose();
  removeTestData();
});

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("[US-28] quy trinh: tai xe quet ma lay don 1, ghi khong lay duoc don 2 -> kho thay nguyen nhan va giao lai -> nguoi nhan thay Da lay hang", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  const [o1, o2] = orders.map((o) => o.trackingCode);

  // 1. Tai Xe 4 tren dien thoai
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await login(phone, "taixe4@edms.vn");
  await phone.getByRole("button", { name: /Đơn cần lấy/ }).click();
  await expect(phone.getByTestId("pickup-counts")).toContainText("Cần lấy: 2");

  // Don 1: quet nham kien khac bi chan, quet dung thi xac nhan
  await phone.getByRole("button", { name: `Đã lấy hàng ${o1}` }).click();
  await expect(phone.getByTestId("pickup-position")).toContainText("Vị trí (giả lập):");
  await phone.getByTestId("pickup-code").fill(o2);
  await phone.getByTestId("pickup-submit").click();
  await expect(phone.getByTestId("pickup-error")).toContainText(`không khớp đơn ${o1}`);
  await phone.getByTestId("pickup-code").fill(o1.toLowerCase());
  await phone.getByTestId("pickup-submit").click();
  await expect(phone.getByTestId("pickup-notice")).toContainText(`Đã lấy hàng ${o1}`);
  await expect(phone.getByTestId(`pickup-${o1}`)).toContainText("Đã lấy");

  // Don 2: khong lay duoc, bat buoc nguyen nhan
  await phone.getByRole("button", { name: `Không lấy được ${o2}` }).click();
  await phone.getByTestId("pickup-submit").click();
  await expect(phone.getByTestId("pickup-error")).toContainText("Chọn nguyên nhân");
  await phone.getByTestId("pickup-reason-NOT_READY").click();
  await phone.getByTestId("pickup-note").fill("Shop hẹn 16 giờ");
  await phone.getByTestId("pickup-submit").click();
  await expect(phone.getByTestId("pickup-notice")).toContainText(`Đã ghi nhận không lấy được ${o2}`);
  await expect(phone.getByTestId("pickup-counts")).toContainText("Cần lấy: 0");
  await expect(phone.getByTestId("pickup-counts")).toContainText("Đã lấy: 1");
  await expect(phone.getByTestId("pickup-counts")).toContainText("Không lấy được: 1");
  await phone.screenshot({ path: `${SHOT_DIR}/28-tai-xe-lay-hang.png`, fullPage: true });

  // 2. Kho thay don 2 o muc "Lay khong duoc", giao lai cho Tai Xe 4 (hen lai)
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /^Phân công/ }).click();
  const failed = page.getByTestId(`assign-failed-${o2}`);
  await expect(failed).toContainText("Không lấy được hàng: Hàng chưa sẵn sàng — Shop hẹn 16 giờ");
  await failed.getByRole("button", { name: `Giao lại ${o2}` }).click();
  await page.getByTestId(`assign-shipper-${driver._id}`).click();
  await page.getByTestId("assign-reason").fill("Shop hẹn lấy lại lúc 16 giờ");
  await page.getByTestId("assign-save").click();
  await expect(page.getByTestId("assign-notice")).toContainText(`Đã giao ${o2} cho Tài Xế 4`);
  await expect(page.getByTestId(`assign-done-${o2}`)).toContainText("Tài Xế 4");

  // 3. Tai xe tai lai: don 2 lai can lay
  await phone.reload();
  await phone.getByRole("button", { name: /Đơn cần lấy/ }).click();
  await expect(phone.getByTestId("pickup-counts")).toContainText("Cần lấy: 1");
  await phone.close();

  // 4. Nguoi nhan don 1 tra cuu cong khai: moc "Da lay hang"
  const journey = await json(await api.get(`/tracking/${o1}`));
  expect(journey.statusLabel).toBe("Đã lấy hàng");
  expect(journey.groupLabel).toBe("Đã nhận – Chưa giao");
});
