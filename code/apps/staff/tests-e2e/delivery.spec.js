import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Sprint 6 (de 02) - kiem thu dong nhieu vai tren App Nhan vien + Web Khach hang:
//   1. Kho HN phan cong giao tay don "E2E GH PW ..." da toi buu cuc Da Nang (PO-DN truc thuoc HUB-HN) cho Tai Xe 4 ->
//      Tai Xe 4 xem phieu giao co QR, quet ma nhan kien, giao thanh cong va thu dung tien COD -> nguoi nhan tra
//      cuu thay "Da giao" (US-35, US-31, US-32, US-33).
//   2. Tai Xe 4 giao khong duoc vi nguoi nhan tu choi -> hoan hang tu phan cong cho Tai Xe 1 (tuyen lay hang Ha
//      Noi) -> Tai Xe 1 tra hang -> Shop 3 xac nhan "Da nhan lai hang" tren Web -> Da hoan tra (US-32, US-36, US-37).
// Ca thu nghiem "KT35 PW ..." va du lieu "E2E GH PW ..." xoa o afterAll (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const WEB_URL = process.env.E2E_WEB_URL || "http://localhost:5173";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const PHONE = { width: 390, height: 844 };

let api;
let shop;
let kho;
let orders = {};

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "pipe" });
}

const removeTestData = () =>
  mongo(
    'const ids = db.orders.find({ "receiver.name": /^E2E GH PW / }).toArray().map((o) => o._id);' +
      "db.assignments.deleteMany({ orderId: { $in: ids } }); db.orders.deleteMany({ _id: { $in: ids } });" +
      'db.shifts.deleteMany({ name: /^KT35 PW / }); db.pickuplocations.deleteMany({ label: "E2E GH PW Kho HN" });',
  );

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

const auth = async (email) => ({
  Authorization: `Bearer ${(await (await api.post("/auth/login", { data: { emailOrPhone: email, password: PASSWORD } })).json()).data.accessToken}`,
});

test.beforeAll(async () => {
  removeTestData();
  api = await request.newContext({ baseURL: API_URL });
  shop = await auth("shop3@edms.vn");
  kho = await auth("kho1@edms.vn");
  const location = (
    await (
      await api.post("/pickupLocations", {
        headers: shop,
        data: { label: "E2E GH PW Kho HN", contactName: "Chủ Shop 3", contactPhone: "0900000043", address: "1 Hàng Bài", province: "Hà Nội", ward: "Phường Hoàn Kiếm" },
      })
    ).json()
  ).data;
  const standard = (await (await api.get("/public/service-types")).json()).data.find((s) => s.code === "STANDARD");
  const create = async (name, cod) => {
    const res = await api.post("/orders", {
      headers: shop,
      data: {
        pickupLocationId: location._id,
        serviceTypeId: standard._id,
        receiver: { name, phone: "0912345678", address: "20 Điện Biên Phủ", province: "Đà Nẵng", ward: "Phường Thanh Khê" },
        item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10, note: "Gọi trước khi giao" },
        cod,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).data;
  };
  orders.cod = await create("E2E GH PW Thu Hộ", { enabled: true, amount: 200000, feePayer: "RECIPIENT_PAID" });
  orders.refused = await create("E2E GH PW Từ Chối", { enabled: false, feePayer: "SHOP_PREPAID", feePaymentMethod: "QR" });
  // Hai don da toi buu cuc Da Nang (khau lay hang, kho trung chuyen kiem o US-28, US-41); ca ca ngay hom nay:
  // giao R-DN-NOI (Tai Xe 4), hoan R-HN-NOI (Tai Xe 1)
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  mongo(
    `db.orders.updateMany({ "receiver.name": /^E2E GH PW / }, { $set: { status: "AT_DEST_HUB" }, $push: { statusHistory: { status: "AT_DEST_HUB", at: new Date(), note: "Nhận tại kho đích" } } });` +
      `const route = (code) => db.routes.findOne({ code })._id; const user = (email) => db.users.findOne({ email })._id;` +
      `const base = { startTime: "00:00", endTime: "23:59", shiftDate: new Date("${day}T00:00:00+07:00"), assignSeq: 0, createdAt: new Date(), updatedAt: new Date() };` +
      `db.shifts.insertMany([` +
      `{ ...base, code: "KT35PW-DN-${day}", name: "KT35 PW giao", routeId: route("R-DN-NOI"), shipperIds: [user("taixe4@edms.vn")] },` +
      `{ ...base, code: "KT35PW-HN-${day}", name: "KT35 PW hoàn", routeId: route("R-HN-NOI"), shipperIds: [user("taixe1@edms.vn")] }]);`,
  );
});

test.afterAll(async () => {
  removeTestData();
  await api?.dispose();
});

test("[US-35][US-31][US-32][US-33] kho phan cong giao -> tai xe xem phieu QR, nhan kien, giao va thu COD -> nguoi nhan thay Da giao", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  page.on("dialog", (dialog) => dialog.accept());
  // 1. Kho HN: muc "Phan cong giao" -> don moi toi kho Da Nang trong hang cho -> phan cong tay cho Tai Xe 4
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /^Phân công giao/ }).click();
  await expect(page.getByTestId("delivery-policy")).toContainText("giao tối đa 3 lần");
  const queued = page.getByTestId(`delivery-queue-${orders.cod.trackingCode}`);
  await expect(queued).toContainText("Giao · R-DN-NOI");
  await page.getByRole("button", { name: `Phân công tay ${orders.cod.trackingCode}` }).click();
  await page.getByRole("radio", { name: "Tài Xế 4" }).click();
  await page.getByTestId("delivery-assign-reason").fill("Giao trong ca chiều cho Tài Xế 4");
  await page.getByTestId("delivery-assign-save").click();
  await expect(page.getByTestId("delivery-assign-notice")).toContainText(`Đã giao ${orders.cod.trackingCode} cho Tài Xế 4`);
  await expect(page.getByTestId(`delivery-assigned-${orders.cod.trackingCode}`)).toContainText("Người giao: Tài Xế 4");
  await page.screenshot({ path: `${SHOT_DIR}/35-phan-cong-giao.png`, fullPage: true });

  // 2. Tai Xe 4 tren dien thoai: so don can giao, phieu giao QR
  const context = await browser.newContext({ viewport: PHONE });
  const phone = await context.newPage();
  await login(phone, "taixe4@edms.vn");
  await expect(phone.getByTestId("shipper-to-deliver")).not.toHaveText("–");
  await phone.getByRole("button", { name: /Đơn cần giao/ }).click();
  const card = phone.getByTestId(`delivery-${orders.cod.trackingCode}`);
  const expected = 200000 + orders.cod.fee.total;
  const money = (n) => `${n.toLocaleString("vi-VN")} ₫`;
  await expect(card).toContainText("E2E GH PW Thu Hộ · 0912345678");
  await expect(card).toContainText("20 Điện Biên Phủ, Phường Thanh Khê, Đà Nẵng");
  await expect(card).toContainText(`Thu của người nhận: ${money(expected)}`);
  await phone.getByRole("button", { name: `Phiếu giao ${orders.cod.trackingCode}` }).click();
  await expect(phone.getByTestId("slip-qr")).toBeVisible();
  await expect(phone.getByTestId("slip-receiver")).toHaveText("Người nhận: E2E GH PW Thu Hộ · 0912345678");
  await expect(phone.getByTestId("slip")).toContainText("Xã/phường: Phường Thanh Khê, Đà Nẵng");
  await phone.screenshot({ path: `${SHOT_DIR}/31-phieu-giao-qr.png`, fullPage: true });
  await phone.getByRole("button", { name: "Đóng phiếu" }).click();

  // 3. Quet sai ma bi chan; dung ma -> dang giao
  await phone.getByRole("button", { name: `Nhận kiện, đi giao ${orders.cod.trackingCode}` }).click();
  await phone.getByTestId("delivery-code").fill("EXP0000000000");
  await phone.getByTestId("delivery-submit").click();
  await expect(phone.getByTestId("delivery-error")).toContainText("không khớp");
  await phone.getByTestId("delivery-code").fill(orders.cod.trackingCode);
  await phone.getByTestId("delivery-submit").click();
  await expect(phone.getByTestId("delivery-notice")).toContainText("đang đi giao");
  await expect(card).toContainText("Giao · Đang giao");

  // 4. Thu thieu tien bi chan; thu du -> giao thanh cong
  await phone.getByRole("button", { name: `Giao thành công ${orders.cod.trackingCode}` }).click();
  await phone.getByTestId("delivery-amount").fill("200000");
  await phone.getByTestId("delivery-submit").click();
  await expect(phone.getByTestId("delivery-error")).toContainText("Phải thu đủ");
  await phone.getByTestId("delivery-amount").fill(String(expected));
  await phone.getByTestId("delivery-submit").click();
  await expect(phone.getByTestId("delivery-notice")).toContainText(`Giao thành công ${orders.cod.trackingCode} — đã thu ${money(expected)}`);
  await expect(card).toContainText("Giao thành công");
  await phone.screenshot({ path: `${SHOT_DIR}/33-giao-thu-cod.png`, fullPage: true });
  await context.close();

  // 5. Nguoi nhan tra cuu cong khai: Da giao
  const recipient = await browser.newPage();
  await expect
    .poll(
      async () => {
        execFileSync("docker", ["exec", "edms-redis", "sh", "-c", "redis-cli --scan --pattern 'ratelimit:tracking:*' | xargs -r redis-cli del"], { stdio: "ignore" });
        await recipient.goto(`${WEB_URL}/tra-cuu?ma=${orders.cod.trackingCode}`);
        await recipient.getByRole("region", { name: "Kết quả tra cứu" }).waitFor({ timeout: 10_000 }).catch(() => {});
        return recipient.getByRole("region", { name: "Kết quả tra cứu" }).innerText().catch(() => "");
      },
      { timeout: 40_000, intervals: [2_000, 3_000] },
    )
    .toContain("Giao thành công");
  await recipient.close();
});

test("[US-32][US-36][US-37] nguoi nhan tu choi -> hoan hang tu phan cong tuyen lay cu -> tai xe tra hang -> shop xac nhan tren Web", async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const { trackingCode, _id: orderId } = orders.refused;
  // Don dang giao cua Tai Xe 4 (phan cong + nhan kien qua API; giao dien da kiem o test tren)
  const tx4 = await auth("taixe4@edms.vn");
  expect((await api.post("/deliveries/assign", { headers: kho, data: { orderId, shipperId: await userId("taixe4@edms.vn"), reason: "Giao cho Tài Xế 4" } })).status()).toBe(200);
  expect((await api.post(`/deliveries/${orderId}/start`, { headers: tx4, data: { code: trackingCode, lat: 16.06, lng: 108.21 } })).status()).toBe(200);

  // 1. Tai Xe 4: khong giao duoc - nguoi nhan tu choi -> chuyen hoan
  const context = await browser.newContext({ viewport: PHONE });
  const phone = await context.newPage();
  await login(phone, "taixe4@edms.vn");
  await phone.getByRole("button", { name: /Đơn cần giao/ }).click();
  await phone.getByRole("button", { name: `Không giao được ${trackingCode}` }).click();
  await phone.getByTestId("delivery-submit").click();
  await expect(phone.getByTestId("delivery-error")).toContainText("Chọn nguyên nhân");
  await phone.getByTestId("delivery-reason-REFUSED").click();
  await phone.getByTestId("delivery-submit").click();
  await expect(phone.getByTestId("delivery-notice")).toContainText(`${trackingCode}: giao không thành công lần 1 — chuyển hoàn về người gửi`);
  await context.close();

  // 2. Hoan hang tu phan cong (consumer su kien cua API) cho Tai Xe 1 - tuyen R-HN-NOI cua dia diem lay o Ha Noi
  await expect
    .poll(async () => (await (await api.get(`/orders/${orderId}`, { headers: shop })).json()).data.assignedTo, { timeout: 20_000 })
    .not.toBeNull();
  const back = await browser.newContext({ viewport: PHONE });
  const backPhone = await back.newPage();
  await login(backPhone, "taixe1@edms.vn");
  await backPhone.getByRole("button", { name: /Đơn cần giao/ }).click();
  const card = backPhone.getByTestId(`delivery-${trackingCode}`);
  await expect(card).toContainText("Hoàn hàng");
  await expect(card).toContainText("Trả về: Chủ Shop 3 · 0900000043");
  await expect(card).toContainText("Lý do hoàn: Người nhận từ chối nhận hàng");
  await backPhone.getByRole("button", { name: `Đã trả hàng cho người gửi ${trackingCode}` }).click();
  await backPhone.getByTestId("delivery-submit").click();
  await expect(backPhone.getByTestId("delivery-notice")).toContainText("chờ người gửi xác nhận");
  await back.close();

  // 3. Shop 3 tren Web Khach hang: xac nhan da nhan lai hang -> Da hoan tra
  const web = await browser.newPage();
  await web.goto(`${WEB_URL}/dang-nhap`);
  await web.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("shop3@edms.vn");
  await web.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await web.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await web.waitForURL((url) => !url.pathname.includes("dang-nhap"));
  await web.goto(`${WEB_URL}/don-hang/${orderId}`);
  const section = web.getByRole("region", { name: "Giao hàng và hoàn hàng" });
  await expect(section).toContainText("Đã giao không thành công 1 lần.");
  await expect(section).toContainText("Hoàn về người gửi: Người nhận từ chối nhận hàng.");
  await section.getByRole("button", { name: "Đã nhận lại hàng" }).click();
  await expect(section.getByRole("status")).toHaveText("Đã xác nhận nhận lại hàng");
  await expect(web.getByText("Đã hoàn trả người gửi").first()).toBeVisible();
  await web.screenshot({ path: `${SHOT_DIR}/37-shop-xac-nhan-hoan.png`, fullPage: true });
  await web.close();
});

async function userId(email) {
  const admin = await auth("admin@edms.vn");
  const res = await api.get("/users", { headers: admin, params: { search: email } });
  return (await res.json()).data[0]._id;
}
