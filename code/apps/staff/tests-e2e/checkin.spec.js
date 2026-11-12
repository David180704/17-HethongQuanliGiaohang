import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-29 + US-30 quy trinh lien vai tro: admin them diem check-in "KT29 ..." tren App Nhan vien -> Tai Xe 1 dang cho
// don "E2E CI ..." (da lay hang) chon "dang o" diem do -> app tu check-in -> mat mang: su kien xep hang doi, co mang
// gui lai -> nguoi nhan tra cuu tren Web Khach hang thay cac diem da qua. Du lieu thu xoa o afterAll (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const WEB_URL = process.env.E2E_WEB_URL || "http://localhost:5173";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const POINT = { code: "KT29-PW", name: "KT29 Điểm thử Playwright", lat: "21.0305", lng: "105.8010" };

let order;

function mongo(script) {
  try {
    execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
  } catch {
    // khong co Docker -> bo qua
  }
}

const removeTestData = () =>
  mongo(
    'const ids = db.orders.find({ "receiver.name": /^E2E CI / }).toArray().map((o) => o._id);' +
      "db.checkinlogs.deleteMany({ orderId: { $in: ids } }); db.orders.deleteMany({ _id: { $in: ids } });" +
      // Tra Tai Xe 1 ve diem check-in cua seed truoc khi xoa diem thu nghiem
      'db.users.updateOne({ email: "taixe1@edms.vn" }, { $set: { checkinPointId: db.checkinpoints.findOne({ code: "CP-HN-HUB" })._id } });' +
      "db.checkinpoints.deleteMany({ code: /^KT29-/ });",
  );

// Trang tra cuu gioi han 20 lan/phut/IP (US-22): xoa bo dem truoc khi chay
function resetTrackingLimit() {
  try {
    execFileSync("docker", ["exec", "edms-redis", "sh", "-c", "redis-cli --scan --pattern 'ratelimit:tracking:*' | xargs -r redis-cli del"], {
      stdio: "ignore",
    });
  } catch {
    // khong co Docker -> bo qua
  }
}

test.beforeAll(async () => {
  removeTestData();
  const api = await request.newContext({ baseURL: API_URL });
  const login = async (email) =>
    (await (await api.post("/auth/login", { data: { emailOrPhone: email, password: PASSWORD } })).json()).data.accessToken;
  const shop = { Authorization: `Bearer ${await login("shop3@edms.vn")}` };
  const location = (await (await api.get("/pickupLocations", { headers: shop })).json()).data.find((l) => l.isDefault);
  const service = (await (await api.get("/public/service-types")).json()).data.find((s) => s.code === "STANDARD");
  const res = await api.post("/orders", {
    headers: shop,
    data: {
      pickupLocationId: location._id,
      serviceTypeId: service._id,
      receiver: { name: "E2E CI Nhận", phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
      item: { name: "Sách", weightGram: 500, length: 20, width: 15, height: 5 },
    },
  });
  order = (await res.json()).data;
  await api.dispose();
  // Tai Xe 1 da lay hang va dang cho don (buoc phan cong / lay hang da kiem o US-25, US-28)
  mongo(
    `const tx = db.users.findOne({ email: "taixe1@edms.vn" });` +
      `db.orders.updateOne({ trackingCode: "${order.trackingCode}" }, { $set: { status: "PICKED_UP", assignedTo: tx._id } });`,
  );
});

test.afterAll(removeTestData);

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

test("[US-29][US-30] quy trinh: admin them diem va gan cho tai xe -> tai xe chi check-in duoc o diem do, mat mang xep hang roi gui lai -> nguoi nhan thay diem da qua", async ({
  page,
  browser,
}) => {
  test.setTimeout(3 * 60_000);
  // 1. Admin them diem check-in (ban kinh mac dinh 150 m)
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Điểm check-in", exact: true }).click();
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.getByLabel("Mã điểm", { exact: true }).fill(POINT.code);
  await page.getByLabel("Tên điểm", { exact: true }).fill(POINT.name);
  await page.getByLabel("Vĩ độ (lat)", { exact: true }).fill("95");
  await page.getByLabel("Kinh độ (lng)", { exact: true }).fill(POINT.lng);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Vĩ độ (lat) phải là số từ -90 đến 90")).toBeVisible();
  await page.getByLabel("Vĩ độ (lat)", { exact: true }).fill(POINT.lat);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã thêm mới")).toBeVisible();
  await expect(page.getByText(POINT.name)).toBeVisible();
  await expect(page.getByText("150 m").first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/29-diem-check-in.png`, fullPage: true });

  // Admin gan diem nay lam diem check-in hop le duy nhat cua Tai Xe 1 (yeu cau 12/11/2026)
  await page.getByRole("button", { name: /Quay lại/ }).click();
  await page.getByRole("button", { name: "Người dùng", exact: true }).click();
  await page.getByPlaceholder("Tìm theo email, số điện thoại, họ tên...").fill("taixe1@edms.vn");
  await expect(page.getByText(/Tổng 1 bản ghi/)).toBeVisible();
  await page.getByRole("button", { name: "Sửa Tài Xế 1" }).click();
  await page.getByRole("radio", { name: `${POINT.code} · ${POINT.name}` }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi")).toBeVisible();

  // 2. Tai Xe 1 tren dien thoai: chi thay diem da dang ky; di toi diem do -> tu check-in, ghi moc cho don dang cho
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await context.newPage();
  await login(phone, "taixe1@edms.vn");
  await phone.getByRole("button", { name: /Vị trí & check-in/ }).click();
  await expect(phone.getByTestId(`chk-point-${POINT.code}`)).toContainText("bán kính 150 m");
  await expect(phone.getByTestId("chk-point-CP-HN-HUB")).toHaveCount(0);
  await phone.getByRole("button", { name: `Đang ở ${POINT.code}` }).click();
  await expect(phone.getByTestId("chk-position")).toContainText(POINT.name);
  await expect(phone.getByTestId("chk-last")).toContainText(`${POINT.name} (0 m) — ghi`);

  // 3. Mat mang khi bam check-in tay -> xep hang doi; co mang -> gui lai (trong 30 phut nen khong ghi trung)
  await context.setOffline(true);
  await phone.getByRole("button", { name: `Check-in tay ${POINT.code}` }).click();
  await expect(phone.getByTestId("chk-last")).toContainText("mất mạng — đã xếp hàng chờ gửi");
  await expect(phone.getByTestId("chk-pending")).toContainText("Đang chờ gửi: 1 check-in");
  await phone.screenshot({ path: `${SHOT_DIR}/30-mat-mang-xep-hang.png`, fullPage: true });
  await context.setOffline(false);
  await phone.getByTestId("chk-flush").click();
  await expect(phone.getByTestId("chk-last")).toContainText("Đã gửi lại 1 check-in");
  await expect(phone.getByTestId("chk-pending")).toHaveCount(0);

  // Quay lai diem cu trong 30 phut -> khong ghi trung
  await phone.getByRole("button", { name: `Đang ở ${POINT.code}` }).click();
  await expect(phone.getByTestId("chk-last")).toContainText("ghi 0 mốc");

  // O Hub Ha Noi (khong phai diem dang ky) -> server khong nhan
  await phone.getByTestId("chk-lat").fill("21.0285");
  await phone.getByTestId("chk-lng").fill("105.8542");
  await phone.getByTestId("chk-set").click();
  await expect(phone.getByTestId("chk-error")).toContainText("chỉ check-in tại điểm đã đăng ký");
  await context.close();

  // 4. Nguoi nhan tra cuu tren Web Khach hang: diem da qua (chi diem hop le)
  resetTrackingLimit();
  const recipient = await browser.newPage();
  await expect
    .poll(
      async () => {
        await recipient.goto(`${WEB_URL}/tra-cuu?ma=${order.trackingCode}`);
        return recipient.getByRole("list", { name: "Điểm check-in đã qua" }).getByRole("listitem").count();
      },
      { timeout: 30_000, intervals: [2_000, 3_000] },
    )
    .toBe(1);
  const items = recipient.getByRole("list", { name: "Điểm check-in đã qua" }).getByRole("listitem");
  await expect(items.first()).toContainText(POINT.name);
  await recipient.screenshot({ path: `${SHOT_DIR}/30-nguoi-nhan-thay-diem.png`, fullPage: true });
  await recipient.close();
});
