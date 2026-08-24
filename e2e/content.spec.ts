import { test, expect } from "@playwright/test";

test("hero renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /colorado ski weekend/i, level: 1 }),
  ).toBeVisible();
});

test("all three destinations render with four labeled tiles each", async ({ page }) => {
  await page.goto("/");

  const cardNames = ["Steamboat Springs", "Summit County", "Winter Park"];
  for (const name of cardNames) {
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  }

  const tileLabels = ["On the mountain", "Getting around", "Food, drink & town", "Off the snow"];
  for (const label of tileLabels) {
    // Each label appears once per destination card (3 cards).
    await expect(page.getByText(label, { exact: true })).toHaveCount(3);
  }
});

test("flight cards link to the correct Google Flights query per airport", async ({ page }) => {
  await page.goto("/");

  const expected: Record<string, string> = {
    SFO: "https://www.google.com/travel/flights?q=Flights%20from%20SFO%20to%20DEN",
    ORD: "https://www.google.com/travel/flights?q=Flights%20from%20ORD%20to%20DEN",
    MKE: "https://www.google.com/travel/flights?q=Flights%20from%20MKE%20to%20DEN",
  };

  const links = page.getByRole("link", { name: /check google flights/i });
  await expect(links).toHaveCount(3);

  const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(new Set(hrefs)).toEqual(new Set(Object.values(expected)));
});

test("Ikon Session Pass pricing is visible and the Base Pass appears only as a note", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("$319").first()).toBeVisible();
  await expect(page.getByText(/already hold the season-long base pass/i)).toBeVisible();

  // The Base Pass shouldn't get a headline price treatment or a second
  // card — it's mentioned only in body text, with no dollar figure at all.
  await expect(page.getByText("$1,019")).toHaveCount(0);
});

test("source links are present under destination and cost sections", async ({ page }) => {
  await page.goto("/");
  const sourceLines = page.getByText("Sources:", { exact: false });
  // Three destinations + the dates section + the cost section.
  await expect(sourceLines).toHaveCount(5);
});
