import { test, expect } from "@playwright/test";

// Loi nguoi dung bao 12/11/2026: "dang nhap roi tao don van bat dang nhap". Nguyen nhan: nhieu tab cung trinh duyet dung
// chung localStorage - tab nay dang xuat / doi tai khoan / lam moi token thi tab kia van hien "da dang nhap" nhung token
// da doi, bam Tao don bi day ve dang nhap. Dung khach5 (file dia diem web cung dung, khong chay song song voi file nay).
const PASSWORD = "123456";

async function login(page, email) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Email hoặc số điện thoại").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("nhieu tab: dang xuat hoac doi tai khoan o tab nay thi tab kia theo ngay", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await login(a, "khach5@edms.vn");
  await b.goto("/tao-don");
  await expect(b.getByRole("heading", { name: "Tạo đơn hàng" })).toBeVisible();

  // Tab A dang xuat -> tab B (dang o trang tao don) chuyen ve dang nhap ngay, khong doi den luc bam gui
  await a.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(b).toHaveURL(/\/dang-nhap/);

  // Tab A dang nhap tai khoan khac -> tab B thay dung nguoi moi
  await login(a, "khach2@edms.vn");
  await b.goto("/tai-khoan");
  await expect(b.getByText("khach2@edms.vn")).toBeVisible();
});

test("nhieu tab: token het han, hai tab cung lam moi mot luc thi khong tab nao bi day ve dang nhap", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await login(a, "khach5@edms.vn");
  await b.goto("/");
  // Gia lap access token het han (chung cho ca hai tab)
  await a.evaluate(() => localStorage.setItem("edms_access_token", "het-han"));
  await Promise.all([a.goto("/tao-don"), b.goto("/tai-khoan")]);
  await expect(a.getByRole("heading", { name: "Tạo đơn hàng" })).toBeVisible();
  await expect(b.getByText("khach5@edms.vn")).toBeVisible();
  await expect(a).toHaveURL(/\/tao-don/);
  await expect(b).toHaveURL(/\/tai-khoan/);
});
