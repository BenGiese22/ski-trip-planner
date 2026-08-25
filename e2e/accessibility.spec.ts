import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { databaseUrl, truncateAll } from "./database";
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
