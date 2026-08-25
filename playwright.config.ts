import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import {
  TEST_ADMIN_COOKIE_SECRET,
  TEST_ADMIN_PASSCODE,
  databaseUrl,
} from "./e2e/database";

// This dev container ships a preinstalled Chromium at a fixed path (see
// repo root system notes); CI runners install their own via
// `playwright install`, so only pin the path when it's actually present.
const localChromiumPath = "/opt/pw-browsers/chromium";
const executablePath = existsSync(localChromiumPath)
  ? localChromiumPath
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
    timeout: 180_000,
    // The app's DB client prefers DATABASE_URL, so this is what keeps a test
    // run pointed at the throwaway Postgres instead of production Supabase.
    env: {
      DATABASE_URL: databaseUrl,
      ADMIN_PASSCODE: TEST_ADMIN_PASSCODE,
      ADMIN_COOKIE_SECRET: TEST_ADMIN_COOKIE_SECRET,
    },
  },
});
