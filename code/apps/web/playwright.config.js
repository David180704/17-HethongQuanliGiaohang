import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  // Chi chay khi API dang noi CSDL local (khong ghi du lieu thu len Atlas)
  globalSetup: "../../scripts/e2e-guard.mjs",
  timeout: 15000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    screenshot: "only-on-failure",
  },
  reporter: [["list"]],
});
