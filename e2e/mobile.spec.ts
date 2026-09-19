import { test, expect, type Page } from "@playwright/test";
import { TEST_ADMIN_PASSCODE, databaseUrl, truncateAll } from "./database";
import { completeIntake, dayCell, pickDestination } from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

// Touch/mobile-only checks: the `mobile-chromium` project already runs the
// full suite, but nothing in it exercises a real touch tap or the WCAG
// tap-target floor. Gating on `isMobile` keeps these from also running
// (redundantly, and with `.tap()` on a mouse-only context) under `chromium`.
test.describe("mobile-only layout checks", () => {
  test.skip(({ isMobile }) => !isMobile);

  test.describe("no sideways scroll", () => {
    // e2e/accessibility.spec.ts already covers the started-but-otherwise-plain
    // state; these are the other states a phone-width layout can still break in.
    test("first visit, before any intake", async ({ page }) => {
      await page.goto("/");
      // Wait past the loading.tsx streaming fallback (Hero + a loading
      // paragraph, no form) to the real first-visit page before measuring.
      await page.getByLabel("Your name").waitFor();
      await expectNoSidewaysScroll(page);
    });

    test("started, plus-one, destination picked", async ({ page }) => {
      await page.goto("/");
      await completeIntake(page, { plusOne: true });
      await pickDestination(page, "steamboat");
      await expectNoSidewaysScroll(page);
    });

    test("finish problems shown", async ({ page }) => {
      await page.goto("/");
      await completeIntake(page);
      await page.getByRole("button", { name: /save & finish/i }).click();
      await expectNoSidewaysScroll(page);
    });

    test("admin, fully populated", async ({ page, browser }) => {
      const guest = await browser.newContext();
      const guestPage = await guest.newPage();
      await guestPage.goto("/");
      await completeIntake(guestPage);
      await pickDestination(guestPage, "steamboat");
      await guestPage.getByRole("button", { name: /save & finish/i }).click();
      await guest.close();

      await page.goto("/admin");
      await page.getByLabel("Passcode").fill(TEST_ADMIN_PASSCODE);
      await page.getByRole("button", { name: /show me the responses/i }).click();
      await expect(page.getByTestId("admin-dashboard")).toBeVisible();
      await expectNoSidewaysScroll(page);
    });
  });

  test("a touch tap cycles a calendar day, not just a mouse click", async ({ page }) => {
    await page.goto("/");
    await completeIntake(page);

    const cell = dayCell(page, "Thursday, January 28");
    await expect(cell).toHaveAccessibleName(/— not set$/);

    // The grid drives painting off pointer events (onPointerDown / a window
    // pointerup), not click — .tap() exercises that path the way .click()'s
    // synthesized mouse events never would.
    await cell.tap();

    await expect(cell).toHaveAccessibleName(/— available$/);
  });

  test("interactive elements clear the 24x24 minimum tap target", async ({ page }) => {
    await page.goto("/");
    await completeIntake(page, { plusOne: true });
    await pickDestination(page, "steamboat");

    const elements = await page.locator("button, a").all();
    const failures: string[] = [];

    for (const el of elements) {
      const box = await el.boundingBox();
      if (!box || box.width === 0 || box.height === 0) continue;

      // WCAG 2.2 SC 2.5.8's "inline" exception: a link sized by the
      // line-height of the sentence it sits in (the destination cards' and
      // cost table's "Sources: ..." citations) isn't held to the 24x24 floor.
      const inlineInRunningText = await el.evaluate((node) => node.closest("p") !== null);
      if (inlineInRunningText) continue;

      if (box.width < 24 || box.height < 24) {
        const label = await el.getAttribute("aria-label");
        const text = (await el.innerText().catch(() => "")).trim().slice(0, 40);
        failures.push(`${box.width.toFixed(1)}x${box.height.toFixed(1)} "${label ?? text}"`);
      }
    }

    expect(failures, `elements under 24x24:\n${failures.join("\n")}`).toEqual([]);
  });

  test("Save & finish stays reachable when problems are shown", async ({ page }) => {
    await page.goto("/");
    await completeIntake(page);
    await page.getByRole("button", { name: /save & finish/i }).click();

    await expect(page.getByRole("alert").first()).toBeVisible();
    const finishButton = page.getByRole("button", { name: /save & finish/i });
    const box = await finishButton.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  });
});
