import { defineConfig } from "@playwright/test";

// Chay App Khach hang mobile ban web (Expo, cong 8083) - can API (4044, CSDL local) va
// "npm run web" dang chay truoc. Tren may ao Android: .maestro/ (code/test-mobile.ps1).
export default defineConfig({
  testDir: "./tests-e2e",
  globalSetup: "../../scripts/e2e-guard.mjs",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8083",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
    locale: "vi-VN",
  },
  reporter: [["list"]],
});
