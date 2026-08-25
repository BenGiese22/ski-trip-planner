import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TEST_ADMIN_PASSCODE, databaseUrl, truncateAll } from "./database";
import { completeIntake } from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

test("the first-visit page has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

// The calendar and the ski-days/gear toggles only exist once intake is done,
// so the first-visit scan never sees them — which is exactly where PLAN.md
// section 14 expects problems to hide.
test("the started page, with grid and toggles, has none either", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page, { plusOne: true });
  await page.getByLabel("Which would you prefer?").selectOption("steamboat");

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test("the gold accent on pine holds up in the save bar", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2aa"])
    .include(".sticky")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the admin passcode gate has no detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/admin");
  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test("the signed-in admin view has none either, empty", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Passcode").fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: /show me the responses/i }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

// The empty dashboard never renders the heatmap, so the scan above never sees
// the density ramp — and the ramp is exactly where a contrast failure would
// hide, since the in-cell numerals sit on five different backgrounds.
test("the heatmap's density ramp holds contrast at every tier", async ({
  page,
  browser,
}) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await completeIntake(guestPage);
  await guestPage.getByLabel("Which would you prefer?").selectOption("steamboat");
  await guestPage.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  // A second press cycles Jan 28 to "maybe", so more than one tier renders.
  await guestPage.getByRole("button", { name: /^Thursday, January 28 —/ }).click();
  const you = guestPage.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await guestPage.getByRole("button", { name: /save & finish/i }).click();
  await expect(guestPage.getByRole("button", { name: /update my answer/i })).toBeVisible();
  await guest.close();

  await page.goto("/admin");
  await page.getByLabel("Passcode").fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: /show me the responses/i }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();
  await expect(page.getByLabel(/January 29 — 1 available/)).toBeVisible();

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});
