import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Sprint 7 (de 02) - kiem thu nhieu vai tren App Nhan vien + Web Khach hang:
//   US-38 Shop 3 bao hu hong tren Web -> Kho 1 ghi tien do, giai quyet co boi thuong tren App -> Shop 3 thay ket qua.
//   US-34, US-43 Ke toan (admin) lap ky doi soat thang 02/2026 (don "E2E DS PW ..." cua Shop 3), dieu chinh, chi tra
//   -> Shop 3 xem ky Da chi tra tren Web. US-39 admin va kho xem thong ke.
// Du lieu thu xoa o afterAll (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const WEB_URL = process.env.E2E_WEB_URL || "http://localhost:5173";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";

let api;
let shop;
const orders = {};

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "pipe" });
}

const removeTestData = () =>
  mongo(
    'const ids = db.orders.find({ "receiver.name": /^E2E (SC|DS) PW / }).toArray().map((o) => o._id);' +
      'db.incidents.deleteMany({ orderId: { $in: ids } }); db.settlements.deleteMany({ periodFrom: new Date("2026-02-01T00:00:00+07:00") });' +
      "db.orders.deleteMany({ _id: { $in: ids } });",
  );

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function webLogin(page, email) {
  await page.goto(`${WEB_URL}/dang-nhap`);
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("dang-nhap"));
}

test.beforeAll(async () => {
  removeTestData();
  api = await request.newContext({ baseURL: API_URL });
  shop = { Authorization: `Bearer ${(await (await api.post("/auth/login", { data: { emailOrPhone: "shop3@edms.vn", password: PASSWORD } })).json()).data.accessToken}` };
  const kho = { Authorization: `Bearer ${(await (await api.post("/auth/login", { data: { emailOrPhone: "kho1@edms.vn", password: PASSWORD } })).json()).data.accessToken}` };
  const location = (await (await api.get("/pickupLocations", { headers: shop })).json()).data.find((l) => l.isDefault);
  const standard = (await (await api.get("/public/service-types")).json()).data.find((s) => s.code === "STANDARD");
  const create = async (name, cod) => {
    const res = await api.post("/orders", {
      headers: shop,
      data: {
        pickupLocationId: location._id,
        serviceTypeId: standard._id,
        receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", ward: "Phường Sài Gòn" },
        item: { name: "Bộ ly thủy tinh", weightGram: 1200, length: 30, width: 20, height: 15 },
        cod,
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()).data;
  };
  orders.incident = await create("E2E SC PW Hư Hỏng", { enabled: false, feePayer: "RECIPIENT_PAID" });
  // Kho cua don duyet (neu dia diem mac dinh cua Shop 3 thuoc pham vi kho 1); khong thi van o CREATED - bao su co duoc
  await api.post(`/orders/${orders.incident._id}/confirm`, { headers: kho });
  orders.settled = await create("E2E DS PW Đã Giao", { enabled: true, amount: 350000, feePayer: "DEDUCT_FROM_COD" });
  // Don da giao thang 02/2026, da thu ho (khau giao kiem o Sprint 6)
  mongo(
    `db.orders.updateOne({ trackingCode: "${orders.settled.trackingCode}" }, { $set: { status: "DELIVERED", "cod.collected": true, "cod.collectedAt": new Date("2026-02-15T10:00:00+07:00"), "cod.method": "CASH" }, $push: { statusHistory: { status: "DELIVERED", at: new Date("2026-02-15T10:00:00+07:00") } } });`,
  );
});

test.afterAll(async () => {
  removeTestData();
  await api?.dispose();
});

test("[US-38] shop bao hu hong tren Web -> kho ghi tien do, giai quyet co boi thuong tren App -> shop thay ket qua", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  const code = orders.incident.trackingCode;
  // 1. Shop 3 tren Web: bao su co tu trang chi tiet don
  const web = await browser.newPage();
  await webLogin(web, "shop3@edms.vn");
  await web.goto(`${WEB_URL}/don-hang/${orders.incident._id}`);
  const section = web.getByRole("region", { name: "Sự cố, khiếu nại" });
  await section.getByRole("button", { name: "Báo sự cố / khiếu nại" }).click();
  await section.getByLabel("Loại sự cố").selectOption("DAMAGED");
  await section.getByLabel("Nội dung").fill("Shipper báo thùng hàng bị móp một góc khi lấy");
  await section.getByRole("button", { name: "Gửi" }).click();
  await expect(section.getByRole("status")).toContainText("Đã gửi SC");
  const incidentCode = (await section.getByRole("status").innerText()).match(/SC\d{6}/)[0];
  await expect(section.getByRole("listitem", { name: `Sự cố ${incidentCode}` })).toContainText("Mới ghi nhận");
  await expect(web.getByText("Đang xử lý sự cố").first()).toBeVisible();

  // 2. Admin tren App Nhan vien (moi kho deu xu ly duoc su co trong pham vi): tien do -> giai quyet + boi thuong
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: /^Sự cố, khiếu nại/ }).click();
  const card = page.getByTestId(`incident-${incidentCode}`);
  await expect(card).toContainText(`${incidentCode} · ${code}`);
  await expect(card).toContainText("Hư hỏng hàng hóa · Người gửi báo");
  await page.getByRole("button", { name: `Ghi tiến độ ${incidentCode}` }).click();
  await page.getByTestId("incident-note").fill("Đã kiểm tra kiện tại kho, hàng bên trong còn nguyên");
  await page.getByTestId("incident-submit").click();
  await expect(page.getByTestId("incident-notice")).toHaveText("Đã ghi tiến độ xử lý");
  await page.getByRole("radio", { name: "Đang xử lý", exact: true }).click();
  await page.getByRole("button", { name: `Giải quyết ${incidentCode}` }).click();
  await page.getByTestId("incident-result").fill("Đóng gói lại, tiếp tục giao; hỗ trợ một phần phí");
  await page.getByTestId("incident-compensation").fill("30000");
  await page.getByTestId("incident-submit").click();
  await expect(page.getByTestId("incident-notice")).toHaveText(`Đã giải quyết ${incidentCode}`);
  await page.screenshot({ path: `${SHOT_DIR}/38-su-co-giai-quyet.png`, fullPage: true });

  // 3. Shop 3 tai lai trang don: da giai quyet, boi thuong vao doi soat
  await web.reload();
  const item = web.getByRole("region", { name: "Sự cố, khiếu nại" }).getByRole("listitem", { name: `Sự cố ${incidentCode}` });
  await expect(item).toContainText("Đã giải quyết");
  await expect(item).toContainText("Bồi thường 30.000 ₫ — cộng vào kỳ đối soát");
  await web.close();
});

test("[US-34][US-43] ke toan lap ky doi soat, dieu chinh, chi tra tren App -> shop xem ky Da chi tra tren Web", async ({ page, browser }) => {
  test.setTimeout(3 * 60_000);
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: /^Đối soát/ }).click();
  await page.getByTestId("settlement-from").fill("2026-02-01");
  await page.getByTestId("settlement-to").fill("2026-02-28");
  await page.getByTestId("settlement-preview").click();
  const money = (n) => `${n.toLocaleString("vi-VN")} ₫`;
  await expect(page.getByTestId("settlement-preview-list")).toContainText(`Shop 3: 1 đơn · thu hộ ${money(350000)}`);
  await page.getByTestId("settlement-run").click();
  await expect(page.getByTestId("settlement-notice")).toContainText("Đã lập 1 kỳ đối soát: DS");
  const settlementCode = (await page.getByTestId("settlement-notice").innerText()).match(/DS\d{6}/)[0];
  // So tien thuc tra = thu ho - phi khau tru + boi thuong su co chua doi soat (vd tu kich ban US-38 phia tren)
  const admin = { Authorization: `Bearer ${(await (await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } })).json()).data.accessToken}` };
  const saved = (await (await api.get("/settlements", { headers: admin, params: { search: settlementCode } })).json()).data[0];
  const net = saved.totals.netPayable;
  expect(net).toBe(350000 - orders.settled.fee.total + saved.totals.adjustments);
  const card = page.getByTestId(`settlement-${settlementCode}`);
  await expect(card).toContainText(money(net));
  await page.getByRole("button", { name: `Chi tiết ${settlementCode}` }).click();
  await expect(page.getByTestId("settlement-detail")).toContainText(orders.settled.trackingCode);
  await page.getByTestId("settlement-adjust-amount").fill("-10000");
  await page.getByTestId("settlement-adjust-reason").fill("Phí lưu kho quá hạn");
  await page.getByTestId("settlement-adjust").click();
  await expect(page.getByTestId("settlement-notice")).toHaveText("Đã thêm khoản điều chỉnh");
  await page.getByTestId("settlement-txn").fill("FT26022800777");
  await page.getByTestId("settlement-pay").click();
  await expect(page.getByTestId("settlement-notice")).toHaveText(`Đã ghi nhận chi trả ${settlementCode}: ${money(net - 10000)}`);
  await page.screenshot({ path: `${SHOT_DIR}/43-doi-soat-chi-tra.png`, fullPage: true });

  const web = await browser.newPage();
  await webLogin(web, "shop3@edms.vn");
  await web.getByRole("link", { name: "Đối soát" }).click();
  const period = web.getByRole("region", { name: `Kỳ ${settlementCode}` });
  await expect(period).toContainText("Đã chi trả");
  await expect(period).toContainText(money(net - 10000));
  await expect(period.getByRole("status")).toContainText("mã GD FT26022800777");
  await period.getByRole("button", { name: "Xem từng đơn" }).click();
  await expect(period.getByRole("table", { name: "Đơn trong kỳ" })).toContainText(orders.settled.trackingCode);
  await expect(period.getByRole("list", { name: "Khoản điều chỉnh" })).toContainText("Phí lưu kho quá hạn");
  await web.close();
});

test("[US-39] admin xem thong ke toan he thong, kho xem thong ke cua kho minh", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: /^Thống kê/ }).click();
  await expect(page.getByText("Toàn hệ thống")).toBeVisible();
  for (const id of ["stats-created", "stats-delivered", "stats-revenue", "stats-cod", "stats-settlements", "stats-by-shop", "stats-shippers"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.screenshot({ path: `${SHOT_DIR}/39-thong-ke.png`, fullPage: true });
  await page.getByRole("button", { name: /Quay lại/ }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /^Thống kê/ }).click();
  await expect(page.getByText("Đơn thuộc kho của bạn")).toBeVisible();
  await expect(page.getByTestId("stats-settlements")).toHaveCount(0);
});
