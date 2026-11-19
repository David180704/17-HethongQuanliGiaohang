import { test, expect, request } from "@playwright/test";
import { execFileSync } from "node:child_process";
// Ky ket qua thanh toan dung ham cua API (cung thuat toan VNPay: HMAC-SHA512 tren tham so da sap xep)
import { sign } from "../../api/src/modules/payments/vnpay.js";

// US-18 + US-19 tren Web Khach hang: tao don 4 buoc voi thu ho COD. Chi file nay dung
// shop2@edms.vn. Nguoi nhan cua moi don thu nghiem ten "E2E ...": API khong co chuc nang
// xoa don nen don dep qua mongosh trong CSDL local (e2e-guard da chan khi API dung Atlas).
const API_URL = process.env.E2E_API_URL || "http://localhost:4044";
const PASSWORD = "123456";
const EMAIL = "shop2@edms.vn";
const SHOT_DIR = "tests-e2e/screenshots";

test.afterAll(() => {
  try {
    execFileSync(
      "docker",
      [
        "exec",
        "edms-mongo",
        "mongosh",
        "edms",
        "--quiet",
        "--eval",
        // Giao dich VNPay (US-44) cua don thu nghiem xoa cung don
        'const ids = db.orders.find({ "receiver.name": /^E2E / }, { _id: 1 }).toArray().map((o) => o._id); db.payments.deleteMany({ orderId: { $in: ids } }); db.orders.deleteMany({ _id: { $in: ids } }).deletedCount',
      ],
      { stdio: "ignore" },
    );
  } catch {
    // may khong co Docker -> bo qua don dep
  }
});

async function login(page) {
  await page.goto("/dang-nhap?next=%2Ftao-don");
  await page.getByLabel("Email hoặc số điện thoại").fill(EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tạo đơn hàng" })).toBeVisible();
}

async function fillReceiverAndParcel(page, { ward = "Phường Láng" } = {}) {
  await page.getByLabel("Tên người nhận").fill("E2E Người Mua");
  await page.getByLabel("Số điện thoại người nhận").fill("0987 654 321");
  await page.getByLabel("Địa chỉ nhận (số nhà, đường)").fill("20 Láng Hạ");
  await page.getByLabel("Tỉnh/Thành phố").fill("Hà Nội");
  await page.getByLabel("Xã/Phường").fill(ward);
}

test("[US-18] tao don 4 buoc: buoc sai bi chan ngay, buoc 4 xem phi tung khoan, xac nhan nhan ma van don", async ({ page }) => {
  await login(page);
  // Buoc 1: dia diem mac dinh da chon san
  await expect(page.getByRole("radiogroup", { name: "Địa điểm lấy hàng" }).getByRole("radio").first()).toBeChecked();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Buoc 2: dia gioi 2025 khong con quan/huyen; go ten quan cu hoac phuong cua tinh khac bi chan ngay
  await expect(page.getByLabel("Quận/Huyện")).toHaveCount(0);
  await fillReceiverAndParcel(page, { ward: "Quận Đống Đa" });
  await expect(page.locator("#rc-ward-error")).toContainText('"Quận Đống Đa" không phải xã/phường của Hà Nội');
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("alert").last()).toContainText("không phải xã/phường của Hà Nội");
  await page.getByLabel("Xã/Phường").fill("lang"); // go khong dau, thieu chu "Phường"
  await page.getByLabel("Tên người nhận").click();
  await expect(page.getByLabel("Xã/Phường")).toHaveValue("Phường Láng");
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Buoc 3: kien hang + thu ho 500.000 d, nguoi nhan tra phi
  await page.getByLabel("Tên hàng hóa").fill("Giày thể thao");
  await page.getByLabel("Khối lượng (g)").fill("1200");
  await page.getByLabel("Dài (cm)").fill("30");
  await page.getByLabel("Rộng (cm)").fill("20");
  await page.getByLabel("Cao (cm)").fill("12");
  await page.getByLabel("Thu hộ tiền hàng (COD)").check();
  await page.getByLabel("Số tiền thu hộ (đ)").fill("500000");
  await expect(page.getByRole("radio", { name: "Người nhận trả phí" })).toBeChecked();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  // Buoc 4: phi du kien tach tung khoan; shipper thu = thu ho + phi
  const fee = page.getByRole("region", { name: "Phí dự kiến" });
  await expect(fee.getByLabel("Chi tiết phí dự kiến")).toContainText("Cước cơ bản");
  await expect(fee).toContainText("Shipper thu của người nhận");
  const totalText = await fee.getByLabel("Chi tiết phí dự kiến").locator("div").last().locator("dd").innerText();
  const total = Number(totalText.replace(/\D/g, ""));
  await expect(fee).toContainText(`${(500000 + total).toLocaleString("vi-VN")} ₫`);
  await page.screenshot({ path: `${SHOT_DIR}/13-create-order-confirm.png`, fullPage: true });

  await page.getByRole("button", { name: "Xác nhận tạo đơn" }).click();
  const done = page.getByRole("status");
  await expect(done).toContainText(/EXP\d{10}/);
  await expect(done).toContainText("chờ bưu cục xác nhận");
  const trackingCode = (await done.getByRole("heading").innerText()).trim();

  // Don da luu dung thu ho va nguoi tra phi
  const api = await request.newContext({ baseURL: API_URL });
  const token = (await (await api.post("/auth/login", { data: { emailOrPhone: EMAIL, password: PASSWORD } })).json()).data.accessToken;
  const list = await (await api.get("/orders", { params: { search: trackingCode }, headers: { Authorization: `Bearer ${token}` } })).json();
  expect(list.data[0].cod).toMatchObject({ enabled: true, amount: 500000, feePayer: "RECIPIENT_PAID" });
  expect(list.data[0].status).toBe("CREATED");
  await api.dispose();
});

test("[US-19] khau tru phi vao thu ho: chi chon duoc khi bat thu ho; thu ho nho hon phi thi khong cho xac nhan", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await fillReceiverAndParcel(page);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Tên hàng hóa").fill("Ốp lưng");
  await page.getByLabel("Khối lượng (g)").fill("300");
  await page.getByLabel("Dài (cm)").fill("10");
  await page.getByLabel("Rộng (cm)").fill("10");
  await page.getByLabel("Cao (cm)").fill("5");

  await expect(page.getByRole("radio", { name: "Khấu trừ vào tiền thu hộ" })).toBeDisabled();
  await page.getByLabel("Thu hộ tiền hàng (COD)").check();
  await page.getByLabel("Số tiền thu hộ (đ)").fill("1000");
  await page.getByRole("radio", { name: "Khấu trừ vào tiền thu hộ" }).check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("region", { name: "Phí dự kiến" }).getByRole("alert")).toContainText(
    "Tiền thu hộ nhỏ hơn phí vận chuyển",
  );
  await expect(page.getByRole("button", { name: "Xác nhận tạo đơn" })).toBeDisabled();
  await page.screenshot({ path: `${SHOT_DIR}/14-cod-less-than-fee.png`, fullPage: true });

  // Sua thu ho du lon -> xac nhan duoc; shop nhan lai = thu ho - phi
  await page.getByRole("button", { name: "Quay lại" }).click();
  await page.getByLabel("Số tiền thu hộ (đ)").fill("200000");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("region", { name: "Phí dự kiến" })).toContainText("Express trả lại bạn (tiền thu hộ)");
  await page.getByRole("button", { name: "Xác nhận tạo đơn" }).click();
  await expect(page.getByRole("status")).toContainText(/EXP\d{10}/);
});

// US-44: VNPay sandbox khong goi duoc tu may test -> chan dia chi sandbox.vnpayment.vn va tra ve dung nhu VNPay:
// ky ket qua bang hash secret ma API dev dang dung (chay API voi VNPAY_TMN_CODE / VNPAY_HASH_SECRET, mac dinh duoi day)
const VNPAY_SECRET = process.env.VNPAY_HASH_SECRET || "edms-dev-hash-secret";

async function fakeVnpay(page, responseCode) {
  await page.route("https://sandbox.vnpayment.vn/**", (route) => {
    const sent = new URL(route.request().url()).searchParams;
    const params = {
      vnp_TmnCode: sent.get("vnp_TmnCode"),
      vnp_Amount: sent.get("vnp_Amount"),
      vnp_BankCode: "NCB",
      vnp_OrderInfo: sent.get("vnp_OrderInfo"),
      vnp_PayDate: "20261119120000",
      vnp_TransactionNo: "14500001",
      vnp_ResponseCode: responseCode,
      vnp_TransactionStatus: responseCode === "00" ? "00" : "02",
      vnp_TxnRef: sent.get("vnp_TxnRef"),
    };
    const query = new URLSearchParams({ ...params, vnp_SecureHash: sign(params, VNPAY_SECRET) });
    return route.fulfill({ status: 302, headers: { location: `${sent.get("vnp_ReturnUrl")}?${query}` } });
  });
}

test("[US-44] luong nghiep vu: gui nhanh bat buoc tra truoc -> chon VNPay -> huy thanh toan -> thanh toan lai thanh cong", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await fillReceiverAndParcel(page);
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Tên hàng hóa").fill("Bánh trung thu");
  await page.getByLabel("Khối lượng (g)").fill("900");
  await page.getByLabel("Dài (cm)").fill("20");
  await page.getByLabel("Rộng (cm)").fill("20");
  await page.getByLabel("Cao (cm)").fill("10");

  // Chon gui nhanh -> tu chuyen sang nguoi gui tra truoc, hai cach tra khac bi khoa
  await page.getByRole("radio", { name: "Giao hàng nhanh" }).check();
  await expect(page.getByRole("radio", { name: "Người gửi trả trước" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Người nhận trả phí" })).toBeDisabled();
  await expect(page.getByText("Gửi nhanh bắt buộc người gửi trả trước").first()).toBeVisible();
  await expect(page.getByRole("radio", { name: "Thanh toán online VNPay" })).toBeChecked();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: "Xác nhận tạo đơn" }).click();
  const done = page.getByRole("status");
  await expect(done).toContainText("bưu cục chỉ duyệt đơn sau khi thanh toán");

  // Lan 1: khach huy tren trang VNPay (ma 24) -> ve chi tiet don, bao chua thanh cong, con nut thanh toan
  await fakeVnpay(page, "24");
  await done.getByRole("button", { name: /qua VNPay/ }).click();
  await expect(page).toHaveURL(/\/don-hang\/[0-9a-f]{24}\?thanhToan=FAILED/);
  await expect(page.getByRole("alert").first()).toContainText("Thanh toán chưa thành công");
  const payBox = page.getByRole("region", { name: "Thanh toán phí vận chuyển" });
  await expect(payBox).toContainText("Chưa thanh toán phí vận chuyển");

  // Lan 2: thanh toan thanh cong -> don da tra phi, het nut thanh toan
  await page.unroute("https://sandbox.vnpayment.vn/**");
  await fakeVnpay(page, "00");
  await payBox.getByRole("button", { name: "Thanh toán qua VNPay" }).click();
  await expect(page).toHaveURL(/thanhToan=SUCCESS/);
  await expect(page.getByRole("status").first()).toContainText("Thanh toán VNPay thành công");
  await expect(page.getByLabel("Tình trạng trả phí")).toContainText("Đã thanh toán");
  await expect(page.getByRole("region", { name: "Thanh toán phí vận chuyển" })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/15-vnpay-paid.png`, fullPage: true });
});
