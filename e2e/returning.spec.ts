import { expect, test } from "@playwright/test";
import { databaseUrl, truncateAll } from "./database";
import {
  completeIntake,
  dayCell,
  onlyRespondent,
  pickDestination,
  respondentCount,
} from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

// The whole point of the cookie (PLAN.md section 6): come back later and your
// answers are still there, with no login.
test("a returning visitor's answers are still there after a reload", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page, { plusOne: true });

  await pickDestination(page, "steamboat");
  await page.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  await expect.poll(async () => (await onlyRespondent()).name).toBe("Jamie Rivera");

  await page.reload();

  await expect(page.getByRole("heading", { name: /welcome back, jamie/i })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Jamie Rivera");
  await expect(page.getByLabel("Email")).toHaveValue("jamie@example.com");
  await expect(page.getByLabel("Home airport")).toHaveValue("ORD");
  await expect(page.getByTestId("rank-badge-steamboat")).toHaveText("1st choice");
  await expect(dayCell(page, "Thursday, January 28")).toHaveAccessibleName(/available$/);

  // Still one row — a revisit edits rather than starting over.
  expect(await respondentCount()).toBe(1);
});

test("a different browser starts a fresh response rather than seeing someone else's", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await completeIntake(page);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/");

  await expect(
    otherPage.getByRole("button", { name: /start my response/i }),
  ).toBeVisible();
  await expect(otherPage.getByRole("heading", { name: /welcome back/i })).toBeHidden();
  await expect(otherPage.getByLabel("Your name")).toHaveValue("");

  await other.close();
});

test("editing after finishing keeps the same row and stays final", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await pickDestination(page, "summitCounty");
  await page.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();

  const you = page.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await page.getByRole("button", { name: /save & finish/i }).click();
  await expect.poll(async () => (await onlyRespondent()).submitted_at).not.toBeNull();

  await page.reload();
  await expect(page.getByText(/marked your answer as final/i)).toBeVisible();

  await you.getByRole("button", { name: "3 days" }).click();
  await expect.poll(async () => (await onlyRespondent()).ski_days).toBe(3);

  expect(await respondentCount()).toBe(1);
  expect((await onlyRespondent()).submitted_at).not.toBeNull();
});

test("the identity cookie is httpOnly, so page script can't read it", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const cookie = (await page.context().cookies()).find((c) => c.name === "ski_trip_token");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");

  expect(await page.evaluate(() => document.cookie)).not.toContain("ski_trip_token");
});
