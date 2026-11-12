import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";

const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const SHOT_DIR = "tests-e2e/screenshots";
const PHONE = { width: 390, height: 844 };

// Du lieu do test tao ra deu mang tien to nay de don sach sau khi chay. Khu vuc phuc vu: ca 3.321 xa/phuong
// deu dang phuc vu -> tam go mot xa/phuong co that de admin them lai, xong tra lai dung tuyen cua tinh.
const E2E_AREA = { province: "Điện Biên", ward: "Xã Sín Thầu" };
const E2E_HUB_SEARCH = "-E2E-"; // ma HUB-E2E-xxxx, PO-E2E-xxxx

async function login(page, email) {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function cleanupE2EData() {
  const api = await request.newContext({ baseURL: API_URL });
  const loginRes = await api.post("/auth/login", { data: { emailOrPhone: "admin@edms.vn", password: PASSWORD } });
  const token = (await loginRes.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  // Buu cuc truoc, hub sau (hub con buu cuc truc thuoc thi khong xoa duoc)
  const hubs = (await (await api.get("/hubs", { params: { search: E2E_HUB_SEARCH, limit: 100 }, headers })).json()).data;
  const postOfficesFirst = [...hubs].sort((a, b) => Number(a.type === "HUB") - Number(b.type === "HUB"));
  for (const hub of postOfficesFirst) await api.delete(`/hubs/${hub._id}`, { headers });
  await api.dispose();
  restoreArea();
}

function mongo(script) {
  execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "pipe" });
}
const removeArea = () => mongo(`db.serviceareas.deleteMany({ province: "${E2E_AREA.province}", ward: "${E2E_AREA.ward}" })`);
function restoreArea() {
  mongo(
    `const s = db.serviceareas.findOne({ province: "${E2E_AREA.province}", ward: { $ne: "${E2E_AREA.ward}" } });` +
      `db.serviceareas.updateOne({ province: "${E2E_AREA.province}", ward: "${E2E_AREA.ward}" }, { $set: { region: s.region, routeId: s.routeId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true })`,
  );
}

test.beforeEach(async ({ page }) => {
  // window.confirm (xoa, dang xuat) -> bam Dong y
  page.on("dialog", (dialog) => dialog.accept());
});

test.afterAll(cleanupE2EData);

test("chua dang nhap chi thay man hinh dang nhap", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EDMS Nhân viên" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await expect(page.getByText(/Máy chủ: http:\/\/localhost:4044/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-login.png`, fullPage: true });
});

test("tai khoan CUSTOMER bi server tu choi o App Nhan vien", async ({ page }) => {
  await login(page, "khach1@edms.vn");
  await expect(page.getByRole("alert")).toContainText("Tài khoản khách hàng không đăng nhập được App Nhân viên");
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-customer-rejected.png`, fullPage: true });
});

test("sai mat khau hien thong bao loi tieng Viet", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("admin@edms.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("sai-mat-khau");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("không đúng");
});

test("ADMIN vao trang quan tri, so ban ghi that, phien con sau khi tai lai trang", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await expect(page.getByText("Admin EDMS")).toBeVisible();
  for (const name of ["Người dùng", "Hub & bưu cục", "Tuyến", "Khu vực phục vụ", "Loại dịch vụ", "Bảng giá"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  }
  await expect(page.getByText(/\d+ bản ghi/).first()).toBeVisible();
  // Sprint 7 da co: su co, doi soat, thong ke (khong con muc "Sap co")
  for (const name of ["Sự cố, khiếu nại", "Đối soát", "Thống kê"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
  }
  await expect(page.getByText(/Sắp có/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/03-admin-home-desktop.png`, fullPage: true });

  await page.reload();
  await expect(page.getByText("Admin EDMS")).toBeVisible();
});

test("ADMIN: danh sach tuyen tu seed, form them moi bat loi bo trong", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Tuyến", exact: true }).click();
  await expect(page.getByText("Nội thành Hà Nội")).toBeVisible();
  await expect(page.getByText(/Tổng \d+ bản ghi/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-routes-list.png`, fullPage: true });

  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await expect(page.getByRole("heading", { name: "Thêm tuyến" })).toBeVisible();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Vui lòng nhập mã tuyến");
  await page.screenshot({ path: `${SHOT_DIR}/05-routes-form-validation.png`, fullPage: true });
});

test("ADMIN: them, sua, xoa khu vuc phuc vu tren du lieu that", async ({ page }) => {
  const district = E2E_AREA.ward;
  removeArea();
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Khu vực phục vụ", exact: true }).click();

  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  // Xa/phuong phai co that va thuoc dung tinh: go phuong cua tinh khac bi tu choi
  await page.getByLabel("Tỉnh/Thành phố", { exact: true }).fill("dien bien");
  await page.getByLabel("Xã/Phường", { exact: true }).fill("Phường Ba Đình");
  await page.getByRole("radio", { name: "Miền Bắc", exact: true }).click();
  // Lua chon tuyen tai dong tu GET /routes
  await page.getByRole("radio", { name: /R-HN-NOI/ }).click();
  await page.screenshot({ path: `${SHOT_DIR}/06-area-create-form.png`, fullPage: true });
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText('"Phường Ba Đình" không thuộc Điện Biên');
  await page.getByLabel("Xã/Phường", { exact: true }).fill("sin thau"); // go khong dau, luu ten chuan
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã thêm mới")).toBeVisible();
  await page.getByPlaceholder("Tìm theo tỉnh, xã/phường...").fill("Sín Thầu");
  await expect(page.getByText(district)).toBeVisible();

  await page.getByRole("button", { name: `Sửa ${district}` }).click();
  await page.getByRole("radio", { name: "Miền Trung", exact: true }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã lưu thay đổi")).toBeVisible();

  await expect(page.getByText(/Tổng 1 bản ghi/)).toBeVisible();
  await expect(page.getByText("Miền Trung", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-area-after-edit.png`, fullPage: true });

  await page.getByRole("button", { name: `Xóa ${district}` }).click();
  await expect(page.getByText(`Đã xóa "${district}"`)).toBeVisible();
  await expect(page.getByText(/Tổng 0 bản ghi/)).toBeVisible();
});

test("ADMIN: o so nhan dau phay thap phan, server tu choi ma dich vu trung", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Loại dịch vụ", exact: true }).click();
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.getByRole("radio", { name: "Gửi nhanh" }).click();
  await page.getByLabel("Tên hiển thị", { exact: true }).fill("Trùng mã");
  await page.getByLabel("Hệ số phụ phí", { exact: true }).fill("0,5");
  await page.getByLabel("Số ngày giao dự kiến", { exact: true }).fill("1");
  await expect(page.getByRole("checkbox", { name: "Đang hoạt động" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  // EXPRESS da co san trong seed -> server bao trung, form van mo de sua
  await expect(page.getByRole("alert")).toContainText("Dữ liệu bị trùng với bản ghi đã tồn tại");
  await expect(page.getByRole("heading", { name: "Thêm loại dịch vụ" })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-service-type-duplicate.png`, fullPage: true });
});

test("[US-13] ADMIN: bang gia - bac chong lan va trung khoang hieu luc bi bao loi ngay tren form", async ({ page }) => {
  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Bảng giá", exact: true }).click();
  await expect(page.getByText(/Tổng 8 bản ghi/)).toBeVisible();
  await expect(page.getByText("Liên miền · Giao hàng nhanh")).toBeVisible();

  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await page.getByRole("radio", { name: "Giao hàng nhanh" }).click();
  await page.getByRole("radio", { name: "Liên miền" }).click();
  await page.getByLabel("Hiệu lực từ ngày", { exact: true }).fill("2027-01-01");
  const cell = (row, column) => page.getByLabel(`Bậc ${row} - ${column}`, { exact: true });
  await cell(1, "Từ (g)").fill("0");
  await cell(1, "Đến (g)").fill("600");
  await cell(1, "Giá cơ bản").fill("40000");
  await cell(1, "+ mỗi 500 g").fill("6000");
  // Dong moi tu dien "Tu" = "Den" cua dong truoc; sua thanh 500 de chong lan 500-600
  await page.getByRole("button", { name: "+ Thêm bậc" }).click();
  await expect(cell(2, "Từ (g)")).toHaveValue("600");
  await cell(2, "Từ (g)").fill("500");
  await cell(2, "Đến (g)").fill("999999999");
  await cell(2, "Giá cơ bản").fill("48000");
  await cell(2, "+ mỗi 500 g").fill("6000");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("chồng lấn");

  // Sua bac 2 cho noi tiep -> qua kiem tra bac, nhung bang gia seed Lien mien/Gui nhanh khong thoi han
  await cell(2, "Từ (g)").fill("600");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Trùng khoảng hiệu lực");
  await page.screenshot({ path: `${SHOT_DIR}/14-price-table-overlap.png`, fullPage: true });
});

test("[US-14] ADMIN: mo hub va buu cuc truc thuoc, ngoai vung phuc vu bi chan, tuyen chon duoc buu cuc moi", async ({ page }) => {
  const stamp = Date.now().toString().slice(-6);
  const hubCode = `HUB-E2E-${stamp}`;
  const poCode = `PO-E2E-${stamp}`;
  const hubName = `Hub E2E ${stamp}`;
  const poName = `Bưu cục E2E ${stamp}`;
  const field = (label) => page.getByLabel(label, { exact: true });
  const save = () => page.getByRole("button", { name: "Lưu", exact: true }).click();

  await login(page, "admin@edms.vn");
  await page.getByRole("button", { name: "Hub & bưu cục", exact: true }).click();
  await expect(page.getByText("Hub Hà Nội", { exact: true })).toBeVisible();
  // Buu cuc Da Nang (seed) truc thuoc Hub Ha Noi
  await expect(page.getByText("HUB-HN — Hub Hà Nội")).toBeVisible();

  // 1. Hub: khong co o "Truc thuoc"; xa/phuong khong thuoc tinh bi server chan
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await field("Mã điểm").fill(hubCode);
  await field("Tên điểm").fill(hubName);
  await page.getByRole("radio", { name: "Hub — điểm tập kết", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Trực thuộc hub" })).toHaveCount(0);
  await field("Tỉnh/Thành phố").fill("Hà Nội");
  await field("Xã/Phường").fill("Quận Cầu Giấy"); // cap quan/huyen da bo tu 01/07/2025
  await save();
  await expect(page.getByRole("alert")).toContainText('"Quận Cầu Giấy" không thuộc Hà Nội');
  await field("Xã/Phường").fill("cau giay"); // go khong dau, server luu ten chuan
  await save();
  await expect(page.getByText("Đã thêm mới")).toBeVisible();

  // 2. Buu cuc: bat buoc chon hub cap tren, o chon chi liet ke HUB (khong co buu cuc)
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await field("Mã điểm").fill(poCode);
  await field("Tên điểm").fill(poName);
  await page.getByRole("radio", { name: "Bưu cục", exact: true }).click();
  await expect(page.getByRole("radio", { name: new RegExp(hubCode) })).toBeVisible();
  await expect(page.getByRole("radio", { name: /PO-DN/ })).toHaveCount(0);
  await field("Tỉnh/Thành phố").fill("Hà Nội");
  await field("Xã/Phường").fill("Phường Đống Đa");
  await save();
  await expect(page.getByRole("alert")).toContainText("Vui lòng chọn trực thuộc hub");
  await page.getByRole("radio", { name: new RegExp(hubCode) }).click();
  await save();
  await expect(page.getByText("Đã thêm mới")).toBeVisible();

  const search = page.getByPlaceholder("Tìm theo mã, tên, tỉnh, xã/phường...");
  await search.fill(poCode);
  await expect(page.getByText(/Tổng 1 bản ghi/)).toBeVisible();
  await expect(page.getByText(`${hubCode} — ${hubName}`)).toBeVisible();
  await expect(page.getByText("Phường Đống Đa, Hà Nội")).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/15-hub-post-office.png`, fullPage: true });

  // 3. Hub con buu cuc truc thuoc -> khong xoa duoc
  await search.fill(hubCode);
  await expect(page.getByText("Cầu Giấy, Hà Nội")).toBeVisible();
  await page.getByRole("button", { name: `Xóa ${hubName}` }).click();
  await expect(page.getByRole("alert")).toContainText("bưu cục trực thuộc");

  // 4. Form tuyen chon hub tu danh muc (het go ObjectId), co ca buu cuc vua mo
  await page.getByRole("button", { name: "Quay lại" }).click();
  await page.getByRole("button", { name: "Tuyến", exact: true }).click();
  await page.getByRole("button", { name: "+ Thêm mới" }).click();
  await expect(page.getByRole("radio", { name: `${poCode} — ${poName}` })).toBeVisible();
  await expect(page.getByText("ObjectId")).toHaveCount(0);
  await page.getByRole("button", { name: "Hủy", exact: true }).click();

  // 5. Dong diem qua giao dien: buu cuc truoc, hub sau
  await page.getByRole("button", { name: "Quay lại" }).click();
  await page.getByRole("button", { name: "Hub & bưu cục", exact: true }).click();
  await search.fill(`E2E-${stamp}`);
  await expect(page.getByText(/Tổng 2 bản ghi/)).toBeVisible();
  await page.getByRole("button", { name: `Xóa ${poName}` }).click();
  await expect(page.getByText(`Đã xóa "${poName}"`)).toBeVisible();
  await page.getByRole("button", { name: `Xóa ${hubName}` }).click();
  await expect(page.getByText(`Đã xóa "${hubName}"`)).toBeVisible();
});

// Khach (shop3) tao don qua API tu mot dia diem o Cau Giay - tuyen R-HN-NOI do Hub Ha Noi
// quan ly -> nhan vien kho1 (Hub Ha Noi) phai thay don trong hang cho duyet.
async function createOrderForHubHn() {
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: "shop3@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const location = await api.post("/pickupLocations", {
    headers,
    data: {
      label: "E2E Kho Duyệt",
      contactName: "Chủ Shop 3",
      contactPhone: "0900000043",
      address: "1 Trần Thái Tông",
      province: "Hà Nội",
      ward: "Phường Cầu Giấy",
    },
  });
  const serviceTypes = (await (await api.get("/public/service-types")).json()).data;
  const order = await api.post("/orders", {
    headers,
    data: {
      pickupLocationId: (await location.json()).data._id,
      serviceTypeId: serviceTypes[0]._id,
      receiver: { name: "E2E Người Nhận Duyệt", phone: "0911222333", address: "8 Lê Lợi", province: "Hà Nội", ward: "Phường Láng" },
      item: { name: "Sách giáo khoa", weightGram: 700, length: 20, width: 15, height: 5 },
      cod: { enabled: true, amount: 250000, feePayer: "RECIPIENT_PAID" },
    },
  });
  const body = await order.json();
  await api.dispose();
  return body.data;
}

// API khong co chuc nang xoa don: xoa don thu nghiem trong CSDL local qua mongosh roi moi
// xoa duoc dia diem lay hang (con don chua hoan tat thi API chan xoa).
async function cleanupApprovalData() {
  try {
    execFileSync(
      "docker",
      ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", 'db.orders.deleteMany({ "receiver.name": /^E2E / }).deletedCount'],
      { stdio: "ignore" },
    );
  } catch {
    // may khong co Docker -> bo qua
  }
  const api = await request.newContext({ baseURL: API_URL });
  const login = await api.post("/auth/login", { data: { emailOrPhone: "shop3@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const locations = (await (await api.get("/pickupLocations", { headers })).json()).data;
  for (const location of locations.filter((l) => l.label.startsWith("E2E"))) {
    await api.delete(`/pickupLocations/${location._id}`, { headers });
  }
  await api.dispose();
}

test("[US-18] HUB_STAFF duyet don moi: thay don cua hub minh, xac nhan -> phi khoa, don roi khoi hang cho", async ({ page }) => {
  await cleanupApprovalData();
  const order = await createOrderForHubHn();
  expect(order.trackingCode).toMatch(/^EXP\d{10}$/);

  await login(page, "kho1@edms.vn");
  await page.getByRole("button", { name: /Duyệt đơn mới/ }).click();
  await expect(page.getByRole("heading", { name: "Duyệt đơn mới" })).toBeVisible();
  await page.getByTestId("approve-search").fill(order.trackingCode);
  await expect(page.getByTestId("approve-count")).toHaveText("1 đơn chờ xác nhận");
  const card = page.getByTestId(`approve-${order.trackingCode}`);
  await expect(card).toContainText("Shop 3 · Phường Cầu Giấy"); // khach doanh nghiep: hien ten shop
  await expect(card).toContainText("Phường Láng, Hà Nội");
  await expect(card).toContainText("250.000 ₫");
  await page.screenshot({ path: `${SHOT_DIR}/16-hub-approve-orders.png`, fullPage: true });

  await page.getByRole("button", { name: `Xác nhận ${order.trackingCode}` }).click();
  await expect(page.getByText(`Đã xác nhận ${order.trackingCode}`)).toBeVisible();
  await expect(page.getByTestId("approve-count")).toHaveText("0 đơn chờ xác nhận");

  // Don da CONFIRMED, phi khoa
  const api = await request.newContext({ baseURL: API_URL });
  const loginRes = await api.post("/auth/login", { data: { emailOrPhone: "kho1@edms.vn", password: PASSWORD } });
  const headers = { Authorization: `Bearer ${(await loginRes.json()).data.accessToken}` };
  const saved = (await (await api.get(`/orders/${order._id}`, { headers })).json()).data;
  expect(saved.status).toBe("CONFIRMED");
  expect(saved.fee.lockedAt).toBeTruthy();
  await api.dispose();
  await cleanupApprovalData();
});

test("[US-18] HUB_STAFF hub khac (Ho Chi Minh) khong thay don cua Hub Ha Noi", async ({ page }) => {
  await cleanupApprovalData();
  const order = await createOrderForHubHn();
  await login(page, "kho2@edms.vn");
  await page.getByRole("button", { name: /Duyệt đơn mới/ }).click();
  await page.getByTestId("approve-search").fill(order.trackingCode);
  await expect(page.getByTestId("approve-count")).toHaveText("0 đơn chờ xác nhận");
  await expect(page.getByText(`Không có đơn chờ duyệt khớp "${order.trackingCode}"`)).toBeVisible();
  await cleanupApprovalData();
});

test.describe("giao dien dien thoai", () => {
  test.use({ viewport: PHONE });

  test("ADMIN tren dien thoai: luoi 2 cot", async ({ page }) => {
    await login(page, "admin@edms.vn");
    await expect(page.getByText("Admin EDMS")).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/09-admin-home-phone.png`, fullPage: true });
  });

  test("form dai nhat (them nguoi dung): nut Luu va loi luon trong man hinh", async ({ page }) => {
    await login(page, "admin@edms.vn");
    await page.getByRole("button", { name: "Người dùng", exact: true }).click();
    await page.getByRole("button", { name: "+ Thêm mới" }).click();
    // Chon tai xe -> hien them o chon nhieu tuyen (tai tu GET /routes)
    await page.getByRole("radio", { name: "Tài xế giao nhận" }).click();
    await expect(page.getByRole("checkbox", { name: /R-HN-NOI/ })).toBeVisible();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Vui lòng nhập họ tên");
    // ratio 1 = phai nam TRON trong man hinh (mac dinh chi can lo 1 pixel la pass)
    await expect(page.getByRole("alert")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Hủy", exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${SHOT_DIR}/13-user-form-phone.png` });
  });

  test("HUB_STAFF thay hub phu trach va cong viec tai hub", async ({ page }) => {
    await login(page, "kho1@edms.vn");
    // "Đăng xuất" chi co o trang chu - khong de chu "Nhân viên kho" o dong phu de
    // cua man hinh dang nhap lam test pass nham khi dang nhap that bai.
    await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "EDMS Nhân viên" })).toBeVisible();
    await expect(page.getByText(/Hub phụ trách: .+\((HUB|PO)-/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Duyệt đơn mới/ })).toBeEnabled();
    await expect(page.getByText(/^\d+ đơn chờ$/)).toBeVisible();
    await expect(page.getByText(/^\d+ đơn chờ phân công$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Người dùng" })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/10-hub-home-phone.png`, fullPage: true });
  });

  test("SHIPPER thay tuyen, the ca hom nay va khong co menu quan tri", async ({ page }) => {
    await login(page, "taixe1@edms.vn");
    await expect(page.getByText("Ca hôm nay")).toBeVisible();
    await expect(page.getByText(/Tuyến: R-/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Người dùng" })).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/11-shipper-home-phone.png`, fullPage: true });
  });
});

test("dang xuat quay ve man hinh dang nhap", async ({ page }) => {
  await login(page, "taixe1@edms.vn");
  await expect(page.getByText("Ca hôm nay")).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
});

test("song song: ADMIN va SHIPPER dang nhap cung luc, phien khong de nhau", async ({ browser }) => {
  // Moi context = mot "thiet bi" rieng (storage rieng), giong 2 nguoi that.
  const adminContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const shipperContext = await browser.newContext({ viewport: PHONE });
  const adminPage = await adminContext.newPage();
  const shipperPage = await shipperContext.newPage();
  for (const p of [adminPage, shipperPage]) p.on("dialog", (dialog) => dialog.accept());

  await Promise.all([login(adminPage, "admin@edms.vn"), login(shipperPage, "taixe1@edms.vn")]);
  await expect(adminPage.getByText("Admin EDMS")).toBeVisible();
  await expect(shipperPage.getByText("Ca hôm nay")).toBeVisible();
  await adminPage.screenshot({ path: `${SHOT_DIR}/12-parallel-admin.png` });
  await shipperPage.screenshot({ path: `${SHOT_DIR}/12-parallel-shipper.png` });

  // Admin dang xuat khong lam tai xe bi dang xuat theo
  await adminPage.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(adminPage.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  await shipperPage.reload();
  await expect(shipperPage.getByText("Ca hôm nay")).toBeVisible();

  await adminContext.close();
  await shipperContext.close();
});
