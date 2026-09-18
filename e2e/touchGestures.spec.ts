import { expect, test, type Page } from "@playwright/test";
import { databaseUrl, truncateAll } from "./database";
import { availabilityRows, completeIntake, dayCell } from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

// boundingBox() reports real coordinates whether or not the element is
// currently scrolled into view — dispatching raw mouse/touch input at an
// off-screen box silently no-ops, unlike locator.click(), which scrolls for
// you. Every raw pointer/touch sequence below needs this, not just click().
async function cellCenter(page: Page, label: string) {
  const cell = dayCell(page, label);
  await cell.scrollIntoViewIfNeeded();
  const box = (await cell.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("dragging the pointer across days paints the whole span available", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const jan28 = await cellCenter(page, "Thursday, January 28");
  const jan29 = await cellCenter(page, "Friday, January 29");
  const jan30 = await cellCenter(page, "Saturday, January 30");

  await page.mouse.move(jan28.x, jan28.y);
  await page.mouse.down();
  await page.mouse.move(jan29.x, jan29.y);
  await page.mouse.move(jan30.x, jan30.y);
  await page.mouse.up();

  await expect.poll(availabilityRows).toEqual([
    { date: "2027-01-28", status: "available" },
    { date: "2027-01-29", status: "available" },
    { date: "2027-01-30", status: "available" },
  ]);
});

test("releasing a drag without moving cycles just the one day", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const box = await cellCenter(page, "Thursday, January 28");

  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.up();

  const jan28 = dayCell(page, "Thursday, January 28");
  await expect(jan28).toHaveAccessibleName(/available$/);
  await expect.poll(availabilityRows).toEqual([{ date: "2027-01-28", status: "available" }]);
});

// This is the scenario the fix targets directly. Touch gives the cell under
// pointerdown implicit capture, so a drag driven by per-cell pointerenter
// handlers only ever painted that first cell — pointerenter never fired again
// for the rest of the drag. Painting is now driven off the pointer's screen
// position via elementFromPoint instead, which needs real touch input (not
// mouse events) to prove: Chromium only applies implicit pointer capture for
// an actual touch pointer, and CDP's Input.dispatchTouchEvent is the one way
// Playwright can produce that on a multi-point drag.
test("a touch drag paints every day it crosses, not just the first", async ({ page }) => {
  test.skip(
    test.info().project.name !== "mobile-chromium",
    "touch-only regression — needs a touch-capable context",
  );

  await page.goto("/");
  await completeIntake(page);

  const cdp = await page.context().newCDPSession(page);
  async function touch(type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) {
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      // A stable id keeps this reading as one continuous touch. Without it,
      // Chromium treats each dispatch as a different touch point and fires
      // pointercancel partway through — the touch equivalent of letting go
      // and pressing down again, not a drag.
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    });
  }

  const jan28 = await cellCenter(page, "Thursday, January 28");
  const jan29 = await cellCenter(page, "Friday, January 29");
  const jan30 = await cellCenter(page, "Saturday, January 30");

  // A short beat between dispatches, same as a real finger sliding across
  // the screen — CDP drops a touchmove that lands before the previous one
  // (and the app's own React update) has been processed.
  await touch("touchStart", jan28.x, jan28.y);
  await page.waitForTimeout(50);
  await touch("touchMove", jan29.x, jan29.y);
  await page.waitForTimeout(50);
  await touch("touchMove", jan30.x, jan30.y);
  await page.waitForTimeout(50);
  await touch("touchEnd", jan30.x, jan30.y);

  await expect.poll(availabilityRows).toEqual([
    { date: "2027-01-28", status: "available" },
    { date: "2027-01-29", status: "available" },
    { date: "2027-01-30", status: "available" },
  ]);
});

// A phone-width viewport, not just the emulated Pixel 7 the mobile project
// already runs every other test at — this is closer to the narrowest common
// device (an iPhone SE) and would have caught the section rail and cost
// table squeezing content off-screen.
test("the page stays usable at a 320px width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/");
  await completeIntake(page);
  await page.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  await expect(page.getByRole("button", { name: /save & finish/i })).toBeVisible();
});
