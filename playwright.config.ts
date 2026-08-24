import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// This dev container ships a preinstalled Chromium at a fixed path (see
// repo root system notes); CI runners install their own via
// `playwright install`, so only pin the path when it's actually present.
const localChromiumPath = "/opt/pw-browsers/chromium";
const executablePath = existsSync(localChromiumPath)
  ? localChromiumPath
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { executablePath },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
