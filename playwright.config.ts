import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running app (default: local dev server).
// E2E_BASE_URL can point at a preview deployment instead.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    storageState: "e2e/.auth/state.json",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 120_000 },
});
