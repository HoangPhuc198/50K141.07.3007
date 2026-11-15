import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1, // Playwright 1 luồng theo yêu cầu
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node ./node_modules/next/dist/bin/next start -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
