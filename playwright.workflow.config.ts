import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/workflows",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "work/ui-workflow-report", open: "never" }]],
  outputDir: "work/ui-workflow-test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    colorScheme: "light",
    locale: "en-CA",
    timezoneId: "America/Toronto",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } },
    },
  ],
  webServer: {
    command: "pnpm workflow:dev",
    url: "http://127.0.0.1:3100/workflow-lab",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
