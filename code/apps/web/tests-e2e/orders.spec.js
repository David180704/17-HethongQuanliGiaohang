import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

// US-20 tren Web Khach hang: danh sach don loc theo nhom trang thai (4 nhom de 14), ngay tao, ma van don;
// chi tiet don co hanh trinh va phi da khoa. Moi lan chay tao khach rieng e2e-orders<so>@edms.vn (khong dung
// chung khach1-6, shop1-4 cua cac file khac) va don cua khach do; afterAll xoa qua mongosh (CSDL local).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "Test@12345";
const SHOT_DIR = "tests-e2e/screenshots";

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
}

// Web chay nhieu worker song song: moi worker chi xoa khach do chinh no tao (CREATED_EMAILS). Khach sot lai tu
// lan chay bi ngat giua chung thi xoa o beforeAll, nhung chi xoa ban cu hon 10 phut de khong dung worker khac.
const CREATED_EMAILS = [];

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
  removeUsers("{ email: /^e2e-orders\\d+@edms\\.vn$/, createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }"),
);
test.afterAll(() => {
  if (CREATED_EMAILS.length) removeUsers(`{ email: { $in: ${JSON.stringify(CREATED_EMAILS)} } }`);
});

const login = async (api, who, password) =>
  (await (await api.post("/auth/login", { data: { emailOrPhone: who, password } })).json()).data.accessToken;

async function registerCustomer(api) {
  const stamp = `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 900 + 100)}`;
  const email = `e2e-orders${stamp}@edms.vn`;
  const register = await api.post("/auth/register", {
    data: { email, phone: `097${stamp.slice(-7)}`, password: PASSWORD, fullName: "E2E Khách Đơn Hàng", customerType: "INDIVIDUAL" },
  });
  expect(register.status(), await register.text()).toBe(201);
  CREATED_EMAILS.push(email);
  return email;
}

async function loginOnPage(page, email, next) {
  await page.goto(`/dang-nhap?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email hoặc số điện thoại").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

// Tao khach moi + 3 don qua API; kho Hub Ha Noi duyet 1 don; gia lap 1 don dang giao (US-31 lam o Sprint 6)
async function seedCustomer() {
  const api = await request.newContext({ baseURL: API_URL });
  const email = await registerCustomer(api);
  const headers = { Authorization: `Bearer ${await login(api, email, PASSWORD)}` };
  const location = (
    await (
      await api.post("/pickupLocations", {
        headers,
        data: {
          label: "E2E Kho nhà", contactName: "E2E Khách", contactPhone: "0909 555 111", address: "1 Xuân Thủy",
          province: "Hà Nội", district: "Cầu Giấy", ward: "Dịch Vọng Hậu",
        },
      })
    ).json()
  ).data;
  const serviceType = (await (await api.get("/public/service-types")).json()).data.find((s) => s.code === "STANDARD");
  const orders = [];
  for (const name of ["KT20 Nhận Một", "KT20 Nhận Hai", "KT20 Nhận Ba"]) {
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
    `db.orders.updateOne({ trackingCode: "${orders[2].trackingCode}" }, { $set: { status: "OUT_FOR_DELIVERY" }, ` +
      `$push: { statusHistory: { status: "OUT_FOR_DELIVERY", at: new Date() } } })`,
  );
  await api.dispose();
  return { email, orders };
}

test("[US-20] khach loc don theo nhom trang thai, ngay tao, ma van don; mo chi tiet thay hanh trinh va phi da khoa", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { email, orders } = await seedCustomer();
  const [confirmed, waiting, delivering] = orders;

  await loginOnPage(page, email, "/don-hang");
  await expect(page.getByRole("heading", { name: "Đơn hàng của tôi" })).toBeVisible();

  const list = page.getByRole("list", { name: "Danh sách đơn hàng" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("3 đơn")).toBeVisible();
  const deliveringRow = list.getByRole("link", { name: new RegExp(delivering.trackingCode) });
  await expect(deliveringRow).toContainText("Đã nhận – Đang giao");
  await expect(deliveringRow).toContainText("Đang giao hàng");
  await page.screenshot({ path: `${SHOT_DIR}/us20-01-danh-sach.png`, fullPage: true });

  // Loc nhom: chi con don dang giao; nhom Chua nhan co 2 don (moi tao + da xac nhan)
  const groups = page.getByRole("group", { name: "Nhóm trạng thái" });
  await groups.getByRole("button", { name: "Đã nhận – Đang giao" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText(delivering.trackingCode);
  await expect(page).toHaveURL(/group=DELIVERING/);
  await groups.getByRole("button", { name: "Chưa nhận" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list).not.toContainText(delivering.trackingCode);

  // Tim theo ma van don (giu nhom dang chon)
  await page.getByLabel("Tìm đơn").fill(waiting.trackingCode);
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText(waiting.trackingCode);

  // Loc ngay: tu ngay mai -> khong co don; Bo loc -> ve du 3 don
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA");
  await page.getByRole("button", { name: "Bỏ lọc" }).click();
  await page.getByLabel("Từ ngày").fill(tomorrow);
  await expect(page.getByText("Không có đơn nào phù hợp bộ lọc.")).toBeVisible();
  await page.getByRole("button", { name: "Bỏ lọc" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(3);

  // Chi tiet don da duoc kho duyet: hanh trinh 2 moc (moi nhat o tren), phi da khoa
  await list.getByRole("link", { name: new RegExp(confirmed.trackingCode) }).click();
  await expect(page.getByRole("heading", { name: confirmed.trackingCode })).toBeVisible();
  const journey = page.getByRole("region", { name: "Hành trình đơn hàng" });
  await expect(journey.getByRole("listitem")).toHaveCount(2);
  await expect(journey.getByRole("listitem").first()).toContainText("Đã xác nhận, chờ lấy hàng");
  await expect(journey.getByRole("listitem").last()).toContainText("Chờ bưu cục xác nhận");
  await expect(page.getByText(/Phí đã khóa lúc/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Người nhận" })).toContainText("KT20 Nhận Một");
  await page.screenshot({ path: `${SHOT_DIR}/us20-02-chi-tiet.png`, fullPage: true });

  await page.getByRole("link", { name: "← Đơn hàng của tôi" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(3);
});

test("[US-20] don cua khach khac hoac khong ton tai: bao khong tim thay", async ({ page }) => {
  const api = await request.newContext({ baseURL: API_URL });
  const email = await registerCustomer(api);
  await api.dispose();
  await loginOnPage(page, email, "/don-hang/000000000000000000000000");
  await expect(page.getByRole("alert")).toContainText("Không tìm thấy đơn hàng");
  await page.getByRole("link", { name: "← Đơn hàng của tôi" }).click();
  await expect(page.getByText("Bạn chưa có đơn hàng nào.")).toBeVisible();
});
