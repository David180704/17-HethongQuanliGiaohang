import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import QRCode from "qrcode";

// Quet ma QR bang camera (o "Quet / nhap ma van don"): Chromium dung camera gia phat video Y4M co ma QR cua mot don
// that trong pham vi kho HN -> ung dung giai ma, dien ma vao o va tu tra cuu. Tren dien thoai that / may ao la cung
// component (expo-camera), quyen camera chi xin khi bam nut. Chi tra cuu, khong doi du lieu.
const PASSWORD = "123456";

function mongo(script) {
  return execFileSync("docker", ["exec", "edms-mongo", "mongosh", "edms", "--quiet", "--eval", script], { encoding: "utf8" }).trim();
}

// Don dang nam o kho HN (kho1 tra cuu duoc)
const CODE = mongo(
  'const h = db.hubs.findOne({ code: "HUB-HN" })._id;' +
    'print(db.orders.findOne({ status: { $in: ["AT_HUB", "SORTED"] }, currentHubId: h }, { trackingCode: 1 }).trackingCode)',
);

// Video Y4M 1 khung hinh 640x480 (xam): ma QR giua nen trang. Chromium phat lap lai lam hinh camera.
function qrVideo(text, file) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const [w, h, scale] = [640, 480, 9];
  const size = (modules.size + 8) * scale; // 4 o le trang moi phia
  const [x0, y0] = [Math.floor((w - size) / 2), Math.floor((h - size) / 2)];
  const y = Buffer.alloc(w * h, 255);
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) {
      if (!modules.get(r, c)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = y0 + (r + 4) * scale + dy;
        y.fill(0, row * w + x0 + (c + 4) * scale, row * w + x0 + (c + 5) * scale);
      }
    }
  }
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, Buffer.alloc((w * h) / 2, 128)]);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${w} H${h} F30:1 Ip A1:1 C420jpeg\n`), frame]));
}

const VIDEO = resolve("test-results", "camera-qr.y4m");
mkdirSync("test-results", { recursive: true });
qrVideo(CODE, VIDEO);

test.use({
  viewport: { width: 390, height: 844 },
  permissions: ["camera"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${VIDEO}`] },
});

test("[US-41] kho quet ma QR tren kien bang camera: giai ma, dien ma van don va tu tra cuu don", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email hoặc số điện thoại", { exact: true }).fill("kho1@edms.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("button", { name: /^Nhập \/ xuất kho/ }).click();

  await page.getByRole("button", { name: "Quét mã QR bằng camera" }).click();
  await expect(page.getByTestId("wh-code-scan-hint")).toHaveText(`Đã quét: ${CODE}`, { timeout: 20_000 });
  await expect(page.getByTestId("wh-code")).toHaveValue(CODE);
  await expect(page.getByTestId("wh-result")).toContainText(CODE);
  await page.screenshot({ path: "tests-e2e/screenshots/41-quet-qr-camera.png", fullPage: true });
});
