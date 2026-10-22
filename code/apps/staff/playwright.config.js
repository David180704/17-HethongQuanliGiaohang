import { defineConfig } from "@playwright/test";

// Chay App Nhan vien ban web (Expo, cong 8082) - can API (4044) va
// "npm run web" dang chay truoc. Xem tests-e2e/staff.spec.js.
export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8082",
    screenshot: "only-on-failure",
    locale: "vi-VN",
  },
  reporter: [["list"]],
});
