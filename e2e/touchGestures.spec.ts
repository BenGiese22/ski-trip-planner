import { expect, test, type Page } from "@playwright/test";
import { databaseUrl, truncateAll } from "./database";
import { availabilityRows, completeIntake, dayCell } from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

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
      touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
    });
  }

  const jan28 = await cellCenter(page, "Thursday, January 28");
  const jan29 = await cellCenter(page, "Friday, January 29");
  const jan30 = await cellCenter(page, "Saturday, January 30");

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

test("a cancelled touch gesture never cycles the day it started on", async ({ page }) => {
  test.skip(
    test.info().project.name !== "mobile-chromium",
    "touch-only regression — needs a touch-capable context",
  );

  await page.goto("/");
  await completeIntake(page);

  const cdp = await page.context().newCDPSession(page);
  const jan28 = await cellCenter(page, "Thursday, January 28");

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: jan28.x, y: jan28.y, id: 1 }],
  });
  await page.waitForTimeout(50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });

  const jan28Cell = dayCell(page, "Thursday, January 28");
  await expect(jan28Cell).toHaveAccessibleName(/— not set$/);
  await expect.poll(availabilityRows).toEqual([]);
});

test("a right-button drag never paints", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "mouse-only regression");

  await page.goto("/");
  await completeIntake(page);

  const jan28 = await cellCenter(page, "Thursday, January 28");
  const jan29 = await cellCenter(page, "Friday, January 29");
  const jan30 = await cellCenter(page, "Saturday, January 30");

  await page.mouse.move(jan28.x, jan28.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(jan29.x, jan29.y);
  await page.mouse.move(jan30.x, jan30.y);

  await expect(dayCell(page, "Saturday, January 30")).toHaveAccessibleName(/not set$/);
  await expect.poll(availabilityRows).toEqual([]);

  // The context menu can swallow the right button's pointerup, which used
  // to leave the grid "painting" so that a bare hover kept filling days in.
  await page.mouse.up({ button: "right" });
  await page.mouse.move(jan29.x, jan29.y);
  await expect(dayCell(page, "Friday, January 29")).toHaveAccessibleName(/not set$/);
  await expect.poll(availabilityRows).toEqual([]);

  // Positive control: an ordinary left drag afterwards still paints.
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

test("losing window focus mid-drag abandons it", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "mouse-only regression");

  await page.goto("/");
  await completeIntake(page);

  const jan28 = await cellCenter(page, "Thursday, January 28");
  const jan30 = await cellCenter(page, "Saturday, January 30");

  await page.mouse.move(jan28.x, jan28.y);
  await page.mouse.down();
  // Alt-tabbing away mid-drag: the release lands in another window, so the
  // grid never hears the pointerup.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.move(jan30.x, jan30.y);
  await page.mouse.up();

  await expect(dayCell(page, "Thursday, January 28")).toHaveAccessibleName(/not set$/);
  await expect(dayCell(page, "Saturday, January 30")).toHaveAccessibleName(/not set$/);
  await expect.poll(availabilityRows).toEqual([]);
});

test("a mouse move with no button held ends the drag", async ({ page }) => {
  test.skip(test.info().project.name !== "chromium", "mouse-only regression");

  await page.goto("/");
  await completeIntake(page);

  const jan28 = await cellCenter(page, "Thursday, January 28");
  const jan30 = await cellCenter(page, "Saturday, January 30");

  // Reuse the real mouse's pointerId so the synthetic move below is
  // indistinguishable from the drag's own pointer.
  await page.evaluate(() => {
    window.addEventListener(
      "pointerdown",
      (e) => ((window as unknown as { downId: number }).downId = e.pointerId),
      { once: true },
    );
  });
  await page.mouse.move(jan28.x, jan28.y);
  await page.mouse.down();
  // The button came up somewhere the grid never heard about; a move that
  // reports no buttons held is the only evidence the drag is over.
  await page.evaluate(({ x, y }) => {
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: x,
        clientY: y,
        buttons: 0,
        pointerType: "mouse",
        pointerId: (window as unknown as { downId: number }).downId,
        isPrimary: true,
      }),
    );
  }, jan30);
  await page.mouse.up();

  await expect(dayCell(page, "Saturday, January 30")).toHaveAccessibleName(/not set$/);
  await expect.poll(availabilityRows).toEqual([]);
});
