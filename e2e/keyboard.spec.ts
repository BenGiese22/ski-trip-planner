import { test, expect } from "@playwright/test";
import { databaseUrl, truncateAll } from "./database";
import { availabilityRows, completeIntake, dayCell, onlyRespondent } from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

test("every link on the first-visit page is keyboard-reachable with a visible focus indicator", async ({
  page,
}) => {
  await page.goto("/");

  const linkCount = await page.getByRole("link").count();
  expect(linkCount).toBeGreaterThan(0);

  const seen = new Set<string>();
  // Bound the loop generously above the known link count so a stray extra
  // tab stop doesn't hang the test, but still terminate deterministically.
  for (let i = 0; i < linkCount + 40; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    const count = await focused.count();
    if (count === 0) continue;

    const tag = await focused.evaluate((el) => el.tagName.toLowerCase());
    if (tag !== "a") continue;

    const href = await focused.getAttribute("href");
    if (href) seen.add(href);

    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  }

  const allHrefs = await page.getByRole("link").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href")).filter((h): h is string => !!h),
  );
  for (const href of allHrefs) {
    expect(seen.has(href)).toBe(true);
  }
});

// PLAN.md section 14 calls these out by name: in the mockup they were styled
// divs, and they only count as done once they're operable without a mouse.
test("a calendar day can be set entirely from the keyboard", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const jan28 = dayCell(page, "Thursday, January 28");
  await jan28.focus();
  await expect(jan28).toBeFocused();

  const outline = await jan28.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");

  await page.keyboard.press("Enter");
  await expect(jan28).toHaveAccessibleName(/available$/);
  await expect.poll(availabilityRows).toEqual([{ date: "2027-01-28", status: "available" }]);

  await page.keyboard.press(" ");
  await expect(jan28).toHaveAccessibleName(/maybe$/);
});

test("blackout days are skipped by keyboard navigation", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await page.getByLabel("Which would you prefer?").selectOption("steamboat");

  const jan16 = page.getByRole("button", { name: /January 16 — Ikon Session Pass blackout/ });
  // Disabled controls are not tab stops, which is the behaviour we want for a
  // day that simply isn't on the table.
  await expect(jan16).toBeDisabled();
});

test("the ski-days and gear toggles announce their state and work from the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await completeIntake(page);

  const you = page.getByRole("group", { name: "You", exact: true });
  const threeDays = you.getByRole("button", { name: "3 days" });

  await expect(threeDays).toHaveAttribute("aria-pressed", "false");

  await threeDays.focus();
  await page.keyboard.press("Enter");

  await expect(threeDays).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await onlyRespondent()).ski_days).toBe(3);
});
