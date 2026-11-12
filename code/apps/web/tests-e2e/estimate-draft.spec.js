import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// Luong tron ven cua Sprint 3 tren Web Khach hang (US-16 -> US-18): khach vang lai uoc tinh
// phi -> "Gui hang" -> dang ky tai khoan MOI -> man hinh tao don dien san du lieu da nhap
// -> them dia diem lay hang -> tao don voi dung phi da uoc tinh.
const SHOT_DIR = "tests-e2e/screenshots";
const PASSWORD = "Test@12345";

// API khong co chuc nang xoa tai khoan (US-10) nen xoa tai khoan do test dang ky tao (va
// dia diem, don, nhap cua no) thang trong CSDL local qua mongosh cua container, giong flow
// Maestro dang ky. globalSetup e2e-guard da dung test neu API dang dung Atlas.
function removeRegisteredUsers() {
  const script =
    "const ids = db.users.find({ email: /^e2e-draft\\d+@edms\\.vn$/ }).toArray().map((u) => u._id);" +
    "db.orders.deleteMany({ customerId: { $in: ids } }); db.pickuplocations.deleteMany({ customerId: { $in: ids } });" +
    "db.orderdrafts.deleteMany({ customerId: { $in: ids } }); db.users.deleteMany({ _id: { $in: ids } }).deletedCount";
  try {
    execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { stdio: "ignore" });
  } catch {
    // may khong co Docker -> bo qua don dep
  }
}

test.afterAll(removeRegisteredUsers);

test("[US-16] khach vang lai uoc tinh phi -> Gui hang -> dang ky moi -> tao don voi du lieu va phi da uoc tinh", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const stamp = Date.now().toString().slice(-8);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Điều hướng chính", exact: true }).getByRole("link", { name: "Ước tính phí" }).click();
  await expect(page.getByRole("heading", { name: "Ước tính phí vận chuyển" })).toBeVisible();

  const from = page.getByRole("group", { name: "Gửi từ" });
  const to = page.getByRole("group", { name: "Gửi đến" });
  await from.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  await from.getByLabel("Xã/Phường").fill("Phường Cầu Giấy");
  await to.getByLabel("Tỉnh/Thành phố").fill("TP Hồ Chí Minh");
  await to.getByLabel("Xã/Phường").fill("sai gon");
  await page.getByLabel("Khối lượng (g)").fill("1000");
  await page.getByLabel("Dài (cm)").fill("40");
  await page.getByLabel("Rộng (cm)").fill("30");
  await page.getByLabel("Cao (cm)").fill("20");
  await page.getByRole("button", { name: "Tính phí" }).click();

  // 40x30x20 cm quy doi 4,8 kg; lien mien bac 2-5 kg: 80.000 + 5 buoc x 7.000
  await expect(page.getByText("tuyến liên miền · tính theo 4.800 g (khối lượng quy đổi theo kích thước)")).toBeVisible();
  const standard = page.getByRole("article", { name: "Giao hàng tiêu chuẩn" });
  await expect(standard.getByText("115.000 ₫").first()).toBeVisible();
  // Giao nhanh chi trong cung tinh/thanh: Ha Noi -> TP HCM khong co gia, ghi ro ly do
  await expect(page.getByRole("article", { name: "Giao hàng nhanh" })).toContainText("chỉ áp dụng trong cùng tỉnh/thành");
  await expect(page.getByText(/khoảng 1\.1\d\d,?\d* km \(đường chim bay/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-estimate-fee.png`, fullPage: true });

  await standard.getByRole("button", { name: "Gửi hàng gói Giao hàng tiêu chuẩn" }).click();
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftao-don%3Fdraft%3D/);
  await expect(page.getByText("Đăng nhập để tạo đơn và thanh toán.")).toBeVisible();

  await page.getByRole("link", { name: "Đăng ký" }).last().click();
  await expect(page).toHaveURL(/\/dang-ky\?next=%2Ftao-don%3Fdraft%3D/);
  await page.getByLabel("Họ tên").fill("Khách Ước Tính");
  await page.getByLabel("Email").fill(`e2e-draft${stamp}@edms.vn`);
  await page.getByLabel("Số điện thoại").fill(`09${stamp}`);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

  // Ve dung man hinh tao don; tai khoan moi chua co dia diem -> goi y them o Cau Giay
  await expect(page).toHaveURL(/\/tao-don\?draft=/);
  await expect(page.getByText("Bạn ước tính phí gửi từ Phường Cầu Giấy, Hà Nội")).toBeVisible();
  const pickupForm = page.getByRole("form", { name: "Thêm địa điểm lấy hàng" });
  await pickupForm.getByLabel("Tên gợi nhớ").fill("Nhà riêng");
  await pickupForm.getByLabel("Người liên hệ").fill("Khách Ước Tính");
  await pickupForm.getByLabel("Số điện thoại liên hệ").fill(`09${stamp}`);
  await pickupForm.getByLabel("Địa chỉ (số nhà, đường)").fill("1 Xuân Thủy");
  await pickupForm.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  await pickupForm.getByLabel("Xã/Phường").fill("Phường Cầu Giấy");
  await pickupForm.getByRole("button", { name: "Lưu và dùng địa điểm này" }).click();
  await expect(page.getByRole("radio", { name: "Nhà riêng" })).toBeChecked();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Buoc 2: tinh/quan nguoi nhan da dien san tu luc uoc tinh
  await expect(page.getByLabel("Tỉnh/Thành phố")).toHaveValue("TP Hồ Chí Minh");
  await expect(page.getByLabel("Xã/Phường")).toHaveValue("Phường Sài Gòn");
  await page.getByLabel("Tên người nhận").fill("Lê Nhận");
  await page.getByLabel("Số điện thoại người nhận").fill("0912345678");
  await page.getByLabel("Địa chỉ nhận (số nhà, đường)").fill("5 Lý Tự Trọng");
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Buoc 3: kich thuoc va goi dich vu da dien san
  await expect(page.getByLabel("Khối lượng (g)")).toHaveValue("1000");
  await expect(page.getByLabel("Dài (cm)")).toHaveValue("40");
  await expect(page.getByRole("radio", { name: "Giao hàng tiêu chuẩn" })).toBeChecked();
  await page.getByLabel("Tên hàng hóa").fill("Đồ gia dụng");
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Buoc 4: phi du kien dung bang luc uoc tinh
  const fee = page.getByRole("region", { name: "Phí dự kiến" });
  await expect(fee.getByText("115.000 ₫").last()).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận tạo đơn" }).click();
  const done = page.getByRole("status");
  await expect(done).toContainText(/Đã tạo đơn hàng\s*EXP\d{10}/);
  await expect(done).toContainText("Phí vận chuyển: 115.000 ₫");
  await page.screenshot({ path: `${SHOT_DIR}/12-order-created-after-register.png`, fullPage: true });
});
