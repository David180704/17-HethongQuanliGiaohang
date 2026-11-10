import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Kiem thu QUY TRINH lien vai tro tren BA app that cung luc:
//   1. Shop tao don tren Web Khach hang (US-18, US-19)
//   2. Nhan vien kho Hub Ha Noi duyet tren App Nhan vien -> CONFIRMED, phi khoa (US-17, US-18)
//   3. Shop xem "Don hang cua toi" tren Web: trang thai moi, hanh trinh 2 moc (US-20)
//   4. Nguoi nhan (khong dang nhap) tra ma tren App Khach hang: moc moi do hang doi su kien ghi (US-21, US-22)
//   5. Nguoi nhan mo link tra cuu cong khai tren Web (US-22)
// Can API (4044), web (5173), App Nhan vien (8082), App Khach hang (8083).
const STAFF_URL = process.env.E2E_STAFF_URL || "http://localhost:8082";
const CUSTOMER_APP_URL = process.env.E2E_CUSTOMER_URL || "http://localhost:8083";
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const RECEIVER = "KT3 Người Nhận Liên App";

// Ten nguoi nhan rieng "KT3 ..." de bo test khac (create-order.spec, xoa don "E2E ...") chay
// song song khong xoa nham don cua test nay.
function removeTestOrders() {
  try {
    execFileSync(
      "docker",
      ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", 'db.orders.deleteMany({ "receiver.name": /^KT3 / }).deletedCount'],
      { stdio: "ignore" },
    );
  } catch {
    // may khong co Docker -> bo qua don dep
  }
}

test.beforeAll(() => {
  removeTestOrders();
  try {
    // API tra cuu gioi han 20 lan/phut moi IP; moi test deu chay tu may nay
    execFileSync("docker", ["exec", "edms-redis", "sh", "-c", "redis-cli --scan --pattern 'ratelimit:tracking:*' | xargs -r redis-cli del"], {
      stdio: "ignore",
    });
  } catch {
    // khong co Docker -> bo qua
  }
});
test.afterAll(removeTestOrders);

test("[US-18][US-20][US-22] quy trinh: shop tao don tren Web -> kho duyet tren App Nhan vien -> shop thay don doi trang thai -> nguoi nhan tra cuu tren App Khach hang", async ({
  browser,
}) => {
  test.setTimeout(4 * 60_000);
  const customerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const customer = await customerContext.newPage();
  const staff = await staffContext.newPage();

  // 1. Khach (shop2, dia diem mac dinh o Hoan Kiem - tuyen Hub Ha Noi) tao don co thu ho
  await customer.goto("/dang-nhap?next=%2Ftao-don");
  await customer.getByLabel("Email hoặc số điện thoại").fill("shop2@edms.vn");
  await customer.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await customer.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(customer.getByRole("heading", { name: "Tạo đơn hàng" })).toBeVisible();
  await customer.getByRole("button", { name: "Tiếp tục" }).click();
  await customer.getByLabel("Tên người nhận").fill(RECEIVER);
  await customer.getByLabel("Số điện thoại người nhận").fill("0966555444");
  await customer.getByLabel("Địa chỉ nhận (số nhà, đường)").fill("3 Tây Sơn");
  await customer.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  await customer.getByLabel("Quận/Huyện").fill("Đống Đa");
  await customer.getByLabel("Phường/Xã").fill("Quang Trung");
  await customer.getByRole("button", { name: "Tiếp tục" }).click();
  await customer.getByLabel("Tên hàng hóa").fill("Bình giữ nhiệt");
  await customer.getByLabel("Khối lượng (g)").fill("900");
  await customer.getByLabel("Dài (cm)").fill("25");
  await customer.getByLabel("Rộng (cm)").fill("10");
  await customer.getByLabel("Cao (cm)").fill("10");
  await customer.getByLabel("Hàng dễ vỡ (+5.000 đ)").check();
  await customer.getByLabel("Thu hộ tiền hàng (COD)").check();
  await customer.getByLabel("Số tiền thu hộ (đ)").fill("150000");
  await customer.getByRole("button", { name: "Tiếp tục" }).click();
  const quoted = customer.getByRole("region", { name: "Phí dự kiến" });
  await expect(quoted).toContainText("Phụ phí hàng đặc biệt");
  const totalText = await quoted.getByLabel("Chi tiết phí dự kiến").locator("div").last().locator("dd").innerText();
  await customer.getByRole("button", { name: "Xác nhận tạo đơn" }).click();
  const created = customer.getByRole("status");
  await expect(created).toContainText(/EXP\d{10}/);
  const trackingCode = (await created.getByRole("heading").innerText()).trim();
  await expect(created).toContainText(`Phí vận chuyển: ${totalText}`);

  // 2. Nhan vien kho Hub Ha Noi thay don trong hang cho va xac nhan
  await staff.goto(STAFF_URL);
  await staff.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("kho1@edms.vn");
  await staff.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await staff.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await staff.getByRole("button", { name: /Duyệt đơn mới/ }).click();
  await staff.getByTestId("approve-search").fill(trackingCode);
  const card = staff.getByTestId(`approve-${trackingCode}`);
  await expect(card).toContainText(totalText);
  await expect(card).toContainText("150.000 ₫");
  await customer.screenshot({ path: `${SHOT_DIR}/15-cross-customer-created.png` });
  await staff.screenshot({ path: `${SHOT_DIR}/15-cross-staff-approve.png` });
  await staff.getByRole("button", { name: `Xác nhận ${trackingCode}` }).click();
  await expect(staff.getByText(`Đã xác nhận ${trackingCode}`)).toBeVisible();

  // 3. Don cua khach da CONFIRMED, phi khoa dung bang phi khach da xem
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: "shop2@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const [order] = (await (await api.get("/orders", { params: { search: trackingCode }, headers })).json()).data;
  expect(order.status).toBe("CONFIRMED");
  expect(order.fee.lockedAt).toBeTruthy();
  expect(`${order.fee.total.toLocaleString("vi-VN")} ₫`).toBe(totalText);
  expect(order.flags.fragile).toBe(true);
  await api.dispose();

  // 4. Shop xem "Don hang cua toi" tren Web: don da sang "Da xac nhan", hanh trinh 2 moc, phi da khoa
  await customer.goto(`/don-hang?q=${trackingCode}`);
  const row = customer.getByRole("list", { name: "Danh sách đơn hàng" }).getByRole("link", { name: new RegExp(trackingCode) });
  await expect(row).toContainText("Đã xác nhận, chờ lấy hàng");
  await row.click();
  const journey = customer.getByRole("region", { name: "Hành trình đơn hàng" }).getByRole("listitem");
  await expect(journey).toHaveCount(2);
  await expect(journey.first()).toContainText("Đã xác nhận, chờ lấy hàng");
  await expect(customer.getByText(/Phí đã khóa lúc/)).toBeVisible();
  await customer.screenshot({ path: `${SHOT_DIR}/15-cross-customer-detail.png` });

  // 5. Nguoi nhan (thiet bi khac, khong dang nhap) tra ma tren App Khach hang
  const recipientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const recipient = await recipientContext.newPage();
  await recipient.goto(CUSTOMER_APP_URL);
  await expect(recipient.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
  await recipient.getByTestId("home-track-code").fill(trackingCode);
  await recipient.getByTestId("home-track-submit").click();
  await expect(recipient.getByTestId("track-group")).toHaveText("Chưa nhận");
  await expect(recipient.getByTestId("track-event-0")).toContainText("Đã xác nhận, chờ lấy hàng");
  await expect(recipient.getByTestId("track-result")).toContainText("09xx xxx 444");
  await expect(recipient.getByTestId("track-result")).not.toContainText(RECEIVER);
  await recipient.screenshot({ path: `${SHOT_DIR}/15-cross-recipient-track.png` });

  // 6. Link tra cuu cong khai tu trang chi tiet don (shop gui cho nguoi nhan) mo duoc khi khong dang nhap
  const link = await customer.getByRole("link", { name: "Link tra cứu công khai cho người nhận" }).getAttribute("href");
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(link);
  await expect(guest.getByRole("region", { name: "Kết quả tra cứu" })).toContainText("Đã xác nhận, chờ lấy hàng");

  await recipientContext.close();
  await customerContext.close();
  await staffContext.close();
});
