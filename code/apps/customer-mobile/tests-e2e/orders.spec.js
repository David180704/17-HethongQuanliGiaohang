import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-20 tren App Khach hang (ban web, khung dien thoai): danh sach don loc nhom trang thai, khoang thoi
// gian, tim ma van don; chi tiet don co hanh trinh va phi da khoa. Moi lan chay tao khach rieng
// e2e-morders<so>@edms.vn (khong dung chung tai khoan cua file khac); afterAll xoa qua mongosh (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "Test@12345";
const SHOT_DIR = "tests-e2e/screenshots";
const CREATED_EMAILS = [];

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
}

function removeUsers(filter) {
  try {
    mongo(
      `const ids = db.users.find(${filter}).toArray().map((u) => u._id);` +
        "db.orders.deleteMany({ customerId: { $in: ids } }); db.pickuplocations.deleteMany({ customerId: { $in: ids } });" +
        "db.users.deleteMany({ _id: { $in: ids } })",
    );
  } catch {
    // may khong co Docker -> bo qua don dep
  }
}

test.beforeAll(() =>
  removeUsers("{ email: /^e2e-morders\\d+@edms\\.vn$/, createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }"),
);
test.afterAll(() => {
  if (CREATED_EMAILS.length) removeUsers(`{ email: { $in: ${JSON.stringify(CREATED_EMAILS)} } }`);
});

const login = async (api, who, password) =>
  (await (await api.post("/auth/login", { data: { emailOrPhone: who, password } })).json()).data.accessToken;

// Khach moi + 3 don: kho Hub Ha Noi duyet don 1; don 3 gia lap dang giao va tao tu 40 ngay truoc
async function seedCustomer() {
  const api = await request.newContext({ baseURL: API_URL });
  const stamp = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 900 + 100)}`;
  const email = `e2e-morders${stamp}@edms.vn`;
  const register = await api.post("/auth/register", {
    data: { email, phone: `096${stamp.slice(-7)}`, password: PASSWORD, fullName: "E2E Khách Mobile", customerType: "INDIVIDUAL" },
  });
  expect(register.status(), await register.text()).toBe(201);
  CREATED_EMAILS.push(email);
  const headers = { Authorization: `Bearer ${await login(api, email, PASSWORD)}` };
  const location = (
    await (
      await api.post("/pickupLocations", {
        headers,
        data: {
          label: "Kho nhà", contactName: "Khách Mobile", contactPhone: "0909 555 222", address: "1 Xuân Thủy",
          province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
        },
      })
    ).json()
  ).data;
  const serviceType = (await (await api.get("/public/service-types")).json()).data.find((s) => s.code === "STANDARD");
  const orders = [];
  for (const name of ["KT20M Nhận Một", "KT20M Nhận Hai", "KT20M Nhận Ba"]) {
    const res = await api.post("/orders", {
      headers,
      data: {
        pickupLocationId: location._id,
        serviceTypeId: serviceType._id,
        receiver: { name, phone: "0912345678", address: "5 Lý Tự Trọng", province: "TP Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
        item: { name: "Sách", weightGram: 800, length: 20, width: 15, height: 10 },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    orders.push((await res.json()).data);
  }
  const kho = { Authorization: `Bearer ${await login(api, "kho1@edms.vn", "123456")}` };
  expect((await api.post(`/orders/${orders[0]._id}/confirm`, { headers: kho })).status()).toBe(200);
  mongo(
    `db.orders.updateOne({ trackingCode: "${orders[2].trackingCode}" }, { $set: { status: "OUT_FOR_DELIVERY", ` +
      `createdAt: new Date(Date.now() - 40 * 86400000) }, $push: { statusHistory: { status: "OUT_FOR_DELIVERY", at: new Date() } } })`,
  );
  await api.dispose();
  return { email, orders };
}

test("[US-20] mobile: loc don theo nhom trang thai, thoi gian, ma van don; chi tiet co hanh trinh va phi da khoa", async ({
  page,
}) => {
  const { email, orders } = await seedCustomer();
  const [confirmed, waiting, delivering] = orders;

  await page.goto("/");
  await expect(page.getByText("Gửi hàng toàn quốc, theo dõi từng chặng")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("home-login").click();
  await page.getByTestId("login-identity").fill(email);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.getByTestId("account-orders").click();

  await expect(page.getByTestId("orders-total")).toHaveText("3 đơn");
  await expect(page.getByTestId(`order-${delivering.trackingCode}`)).toContainText("Đã nhận – Đang giao");
  await expect(page.getByTestId(`order-${waiting.trackingCode}`)).toContainText("Chờ bưu cục xác nhận");
  await page.screenshot({ path: `${SHOT_DIR}/us20-m01-danh-sach.png`, fullPage: true });

  // Nhom trang thai
  await page.getByTestId("orders-group-DELIVERING").click();
  await expect(page.getByTestId("orders-total")).toHaveText("1 đơn");
  await expect(page.getByTestId(`order-${delivering.trackingCode}`)).toBeVisible();
  await page.getByTestId("orders-group-NOT_RECEIVED").click();
  await expect(page.getByTestId("orders-total")).toHaveText("2 đơn");
  await expect(page.getByTestId(`order-${delivering.trackingCode}`)).toHaveCount(0);

  // Tim theo ma van don (giu nhom dang chon)
  await page.getByTestId("orders-search").fill(waiting.trackingCode);
  await page.getByTestId("orders-search-submit").click();
  await expect(page.getByTestId("orders-total")).toHaveText("1 đơn");
  await expect(page.getByTestId(`order-${waiting.trackingCode}`)).toBeVisible();

  // Thoi gian: don dang giao tao tu 40 ngay truoc -> khong thuoc "30 ngay"
  await page.getByTestId("orders-clear").click();
  await expect(page.getByTestId("orders-total")).toHaveText("3 đơn");
  await page.getByTestId("orders-range-30").click();
  await expect(page.getByTestId("orders-total")).toHaveText("2 đơn");
  await expect(page.getByTestId(`order-${delivering.trackingCode}`)).toHaveCount(0);
  await page.getByTestId("orders-range-ALL").click();
  await expect(page.getByTestId("orders-total")).toHaveText("3 đơn");

  // Chi tiet don da duoc kho duyet: hanh trinh moi nhat o tren, phi da khoa. Mo tu nhom "Chua nhan" ->
  // quay lai van o nhom do (bo loc khong mat khi mo chi tiet).
  await page.getByTestId("orders-group-NOT_RECEIVED").click();
  await expect(page.getByTestId("orders-total")).toHaveText("2 đơn");
  await page.getByTestId(`order-${confirmed.trackingCode}`).click();
  await expect(page.getByTestId("journey-0")).toContainText("Đã xác nhận, chờ lấy hàng");
  await expect(page.getByTestId("journey-1")).toContainText("Chờ bưu cục xác nhận");
  await expect(page.getByTestId("order-detail-status")).toContainText("Chưa nhận");
  await expect(page.getByTestId("order-fee-lock")).toContainText("Phí đã khóa lúc");
  await expect(page.getByText("KT20M Nhận Một · 0912345678")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/us20-m02-chi-tiet.png`, fullPage: true });

  await page.getByTestId("back-button").click();
  await expect(page.getByTestId("orders-total")).toHaveText("2 đơn");
  await expect(page.getByTestId("orders-group-NOT_RECEIVED")).toHaveAttribute("aria-checked", "true");
});
