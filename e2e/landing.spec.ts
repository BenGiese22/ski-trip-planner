import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing page renders the placeholder heading", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /colorado ski trip planner/i }),
  ).toBeVisible();
});

test("landing page has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
