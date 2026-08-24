import { test, expect } from "@playwright/test";

test("every link on the page is keyboard-reachable with a visible focus indicator", async ({
  page,
}) => {
  await page.goto("/");

  const linkCount = await page.getByRole("link").count();
  expect(linkCount).toBeGreaterThan(0);

  const seen = new Set<string>();
  // Bound the loop generously above the known link count so a stray extra
  // tab stop doesn't hang the test, but still terminate deterministically.
  for (let i = 0; i < linkCount + 5; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    const count = await focused.count();
    if (count === 0) continue;

    const tag = await focused.evaluate((el) => el.tagName.toLowerCase());
    if (tag !== "a") continue;

    const href = await focused.getAttribute("href");
    if (href) seen.add(href);

    // Every focused link must have a visible focus outline.
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
