import { test, expect } from "@playwright/test";
import { databaseUrl, truncateAll } from "./database";
import {
  availabilityRows,
  completeIntake,
  dayCell,
  destinationVotes,
  onlyRespondent,
  pickDestination,
} from "./helpers";

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

test("blackout days are keyboard-operable like any other day", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await pickDestination(page, "steamboat");

  // Flagged, but not disabled — so it stays a tab stop and stays usable.
  const jan16 = dayCell(page, "Saturday, January 16");
  await expect(jan16).toBeEnabled();
  await expect(jan16).toHaveAccessibleName(/Ikon Session Pass blackout/);

  await jan16.focus();
  await page.keyboard.press("Enter");
  await expect(jan16).toHaveAccessibleName(/available/);
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

// Drag-and-drop is unreachable by keyboard, so these buttons are the whole
// accessible path to ranking — not a convenience (§17 decision 3).
test("destinations can be ranked entirely from the keyboard", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const up = page.getByRole("button", { name: /Move Winter Park up/ });
  await up.focus();
  await expect(up).toBeFocused();

  const outline = await up.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("rank-badge-winterPark")).toHaveText("2nd choice");

  // Focus must follow the card that moved, or every press loses your place
  // and you have to hunt for the button again.
  await expect(page.getByRole("button", { name: /Move Winter Park up/ })).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("rank-badge-winterPark")).toHaveText("1st choice");

  // Now first, so it can't go higher.
  await expect(page.getByRole("button", { name: /Move Winter Park up/ })).toBeDisabled();
});

test("a reorder is announced, not just shown", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  await page.getByRole("button", { name: /Move Winter Park up/ }).click();

  // A visual reshuffle tells a screen-reader user nothing on its own.
  await expect(page.getByRole("status")).toContainText(/Winter Park moved to 2nd choice/i);
});

test("the ranking persists as an ordering, not just a single pick", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  await page.getByRole("button", { name: /Move Winter Park up/ }).click();
  await page.getByRole("button", { name: /Move Winter Park up/ }).click();
  await expect(page.getByTestId("rank-badge-winterPark")).toHaveText("1st choice");

  // The badge is optimistic. Wait for the write to land before reloading —
  // otherwise this races autosave rather than testing persistence.
  await expect
    .poll(async () => (await destinationVotes()).find((v) => v.rank === 1)?.destination_slug)
    .toBe("winterPark");

  await page.reload();
  await expect(page.getByTestId("rank-badge-winterPark")).toHaveText("1st choice");
  await expect(page.getByTestId("rank-badge-steamboat")).toHaveText("2nd choice");
  await expect(page.getByTestId("rank-badge-summitCounty")).toHaveText("3rd choice");
});
