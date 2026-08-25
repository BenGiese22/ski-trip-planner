import { expect, test } from "@playwright/test";
import { airports } from "../src/data/airports";
import { truncateAll } from "./database";
import { databaseUrl } from "./database";
import {
  availabilityRows,
  completeIntake,
  dayCell,
  destinationVotes,
  onlyRespondent,
  pickDestination,
  respondentCount,
} from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

test("a first-time visitor sees intake and no personalised sections yet", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /start my response/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeHidden();

  // Every airport stands as reference content until we know theirs.
  await expect(page.getByRole("link", { name: /check google flights/i })).toHaveCount(
    airports.length,
  );

  // And the save bar has nothing to save yet.
  await expect(page.getByRole("button", { name: /save & finish/i })).toBeHidden();
});

// Section 16, decision 7: partial intake persists nothing. The trade-off is
// explicit — a ~20-second, five-field step is cheap to redo.
test("nothing is written until intake is complete", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Your name").fill("Jamie Rivera");
  await page.getByLabel("Email").fill("jamie@example.com");
  await page.getByRole("button", { name: /start my response/i }).click();

  // The two unanswered selects are named, and nothing was persisted.
  await expect(page.getByText(/pick the airport you'd fly from/i)).toBeVisible();
  await expect(page.getByText(/how comfortable you are on snow/i)).toBeVisible();
  expect(await respondentCount()).toBe(0);
});

test("intake creates exactly one row and unlocks the rest of the page", async ({
  page,
}) => {
  await page.goto("/");
  await completeIntake(page);

  const respondent = await onlyRespondent();
  expect(respondent.name).toBe("Jamie Rivera");
  expect(respondent.email).toBe("jamie@example.com");
  expect(respondent.home_airport).toBe("ORD");
  expect(respondent.ski_level).toBe("intermediate");
  expect(respondent.submitted_at).toBeNull();

  // Getting there narrows to the one airport that matters to them.
  await expect(page.getByRole("link", { name: /check google flights/i })).toHaveCount(1);
  await expect(page.locator("#getting-there").getByText("ORD — Chicago")).toBeVisible();

  // The calendar and the save bar are now live.
  await expect(page.getByRole("group", { name: "January 2027" })).toBeVisible();
  await expect(page.getByRole("button", { name: /save & finish/i })).toBeVisible();
});

test("the destination choice saves and drives the cost table", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  await pickDestination(page, "winterPark");
  await expect(page.getByText(/estimated for/i)).toBeVisible();

  await expect
    .poll(destinationVotes)
    .toEqual([{ destination_slug: "winterPark", rank: 1 }]);

  await expect(page.getByText(/Winter Park/).first()).toBeVisible();
  await expect(page.getByText("Flight, round trip (ORD)")).toBeVisible();
});

test("marking days saves them, and cycles through the three states", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const jan28 = dayCell(page, "Thursday, January 28");

  await jan28.click();
  await expect(jan28).toHaveAccessibleName(/available$/);
  await expect.poll(availabilityRows).toEqual([{ date: "2027-01-28", status: "available" }]);

  await jan28.click();
  await expect(jan28).toHaveAccessibleName(/maybe$/);
  await expect.poll(availabilityRows).toEqual([{ date: "2027-01-28", status: "maybe" }]);

  await jan28.click();
  await expect(jan28).toHaveAccessibleName(/can't make it$/);

  // Fourth press clears it back to unset, and the row goes with it.
  await jan28.click();
  await expect(jan28).toHaveAccessibleName(/not set$/);
  await expect.poll(availabilityRows).toEqual([]);
});

test("a quick pick fills its whole window in one press", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  await page.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();

  await expect.poll(availabilityRows).toEqual([
    { date: "2027-01-28", status: "available" },
    { date: "2027-01-29", status: "available" },
    { date: "2027-01-30", status: "available" },
    { date: "2027-01-31", status: "available" },
  ]);
});

// Availability and destination preference are separate questions. Blackout
// days are flagged for information and stay fully selectable — gating one on
// the other also trapped data, since a day marked before choosing Steamboat
// became impossible to clear.
test("blackout days are flagged but still selectable", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const jan16 = dayCell(page, "Saturday, January 16");
  await expect(jan16).toBeEnabled();
  // The flag is carried in the accessible name, not by disabling the control.
  await expect(jan16).toHaveAccessibleName(/Ikon Session Pass blackout/);

  await jan16.click();
  await expect(jan16).toHaveAccessibleName(/available/);
  await expect.poll(availabilityRows).toEqual([
    { date: "2027-01-16", status: "available" },
  ]);
});

test("choosing a destination never changes what days can be marked", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);

  const jan16 = dayCell(page, "Saturday, January 16");
  await jan16.click();
  await expect.poll(availabilityRows).toEqual([
    { date: "2027-01-16", status: "available" },
  ]);

  // Steamboat blacks out Jan 16. That must not strand the answer already
  // given: the day stays clearable, which is what the old coupling broke.
  await pickDestination(page, "steamboat");
  await expect(jan16).toBeEnabled();

  await jan16.click(); // -> maybe
  await jan16.click(); // -> can't make it
  await jan16.click(); // -> cleared
  await expect(jan16).toHaveAccessibleName(/not set/);
  await expect.poll(availabilityRows).toEqual([]);
});

test("ski days and gear save per person", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page, { plusOne: true });

  const you = page.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "3 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();

  const partner = page.getByRole("group", { name: "Your plus-one" });
  await partner.getByRole("button", { name: "1 day" }).click();
  await partner.getByRole("button", { name: /bringing their own gear/i }).click();

  await expect.poll(async () => {
    const row = await onlyRespondent();
    return {
      skiDays: row.ski_days,
      gear: row.gear_status,
      plusOneSkiDays: row.plus_one_ski_days,
      plusOneGear: row.plus_one_gear_status,
    };
  }).toEqual({ skiDays: 3, gear: "rental", plusOneSkiDays: 1, plusOneGear: "own" });
});

// Section 16, decision 6 — the assumption has to be stated, not silent.
test("a pass holder's rental assumption is captioned, not hidden", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await pickDestination(page, "summitCounty");

  const you = page.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: /i already have a pass/i }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();

  await expect.poll(async () => (await onlyRespondent()).already_has_pass).toBe(true);
  expect((await onlyRespondent()).ski_days).toBeNull();

  await expect(page.getByText(/assume 2 ski days/i)).toBeVisible();
  // Scoped to the table itself: "Ikon Session Pass" also appears in the
  // headline price card above it, in the explanatory copy, and in the sources.
  const costTable = page.getByTestId("cost-table");
  await expect(costTable.getByText(/^Rental package/)).toBeVisible();
  await expect(costTable.getByText(/Ikon Session Pass/)).toHaveCount(0);
  await expect(costTable.getByText(/lift ticket/i)).toHaveCount(0);
});

test("save & finish refuses an incomplete answer, then accepts a complete one", async ({
  page,
}) => {
  await page.goto("/");
  await completeIntake(page);

  await page.getByRole("button", { name: /save & finish/i }).click();

  await expect(page.locator(".sticky").getByRole("alert")).toContainText(/still need an answer/i);
  await expect(page.locator(".sticky").getByRole("alert")).toContainText(/pick which destination/i);
  await expect(page.locator(".sticky").getByRole("alert")).toContainText(/at least one day/i);
  expect((await onlyRespondent()).submitted_at).toBeNull();

  await pickDestination(page, "summitCounty");
  await page.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  const you = page.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();

  await page.getByRole("button", { name: /save & finish/i }).click();

  await expect.poll(async () => (await onlyRespondent()).submitted_at).not.toBeNull();
  await expect(page.getByRole("button", { name: /update my answer/i })).toBeVisible();
});
