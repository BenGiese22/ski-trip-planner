import { expect, test } from "@playwright/test";
import { databaseUrl, truncateAll } from "./database";
import {
  completeIntake,
  declineAfterStarting,
  declineAsFirstTimer,
  declineRows,
  INTAKE,
  onlyRespondent,
  pickDestination,
  respondentCount,
  respondentIdentity,
} from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

const identityCookie = (cookies: { name: string; value: string; httpOnly: boolean }[]) =>
  cookies.find((c) => c.name === "ski_trip_token");

test("a first-time guest can bow out without starting a response", async ({ page }) => {
  await page.goto("/");
  await declineAsFirstTimer(page, {
    name: "Jamie Rivera",
    email: "jamie@example.com",
    reason: "Away that weekend",
  });

  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know, jamie\./i }),
  ).toBeVisible();

  // The intake form and the decline link both step aside — there's exactly
  // one thing to do from here, and that's reconsider.
  await expect(page.getByLabel("Your name")).toBeHidden();
  await expect(page.getByRole("button", { name: /start my response/i })).toBeHidden();

  const rows = await declineRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    name: "Jamie Rivera",
    email: "jamie@example.com",
    reason: "Away that weekend",
  });
  expect(await respondentCount()).toBe(0);

  const cookie = identityCookie(await page.context().cookies());
  expect(cookie?.value).toBe(rows[0].cookie_token);
  expect(cookie?.httpOnly).toBe(true);
});

test("the decline is recognised on the next visit", async ({ page }) => {
  await page.goto("/");
  await declineAsFirstTimer(page, { name: "Jamie Rivera" });

  await page.reload();

  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know, jamie\./i }),
  ).toBeVisible();
  await expect(page.getByText(/you.ve let ben know you can.t make it/i)).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeHidden();
});

// Reconsidering is deliberately client-side only (section 16, decision 7 —
// nothing is written until intake is complete), so a reload has to land back
// on the decline rather than on a half-started response.
test("reconsidering without finishing intake writes nothing", async ({ page }) => {
  await page.goto("/");
  await declineAsFirstTimer(page, { name: "Jamie Rivera" });

  await page.getByRole("button", { name: /actually, i can make it/i }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know, jamie\./i }),
  ).toBeVisible();
  expect(await declineRows()).toHaveLength(1);
  expect(await respondentCount()).toBe(0);
});

test("finishing intake after a decline replaces it, on a fresh token", async ({ page }) => {
  await page.goto("/");
  await declineAsFirstTimer(page, { name: "Jamie Rivera" });
  const declineToken = identityCookie(await page.context().cookies())?.value;
  expect(declineToken).toBeTruthy();

  await page.getByRole("button", { name: /actually, i can make it/i }).click();
  await completeIntake(page);

  expect(await declineRows()).toEqual([]);
  expect(await respondentCount()).toBe(1);

  // A new token, not the decline's: the old one is what Ben's link-sharing
  // could have leaked, and the row it points at is gone either way.
  const respondentToken = identityCookie(await page.context().cookies())?.value;
  expect(respondentToken).toBeTruthy();
  expect(respondentToken).not.toBe(declineToken);

  await page.reload();
  await expect(page.getByRole("heading", { name: /welcome back, jamie/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();
});

// The textarea's maxLength is a convenience, not the boundary — the API is.
test("an over-long reason is rejected by the API", async ({ request }) => {
  const response = await request.post("/api/declines", {
    data: { name: "Jamie Rivera", reason: "x".repeat(201) },
  });
  expect(response.status()).toBe(400);
  expect(await declineRows()).toEqual([]);
});

test("a started guest can bow out without losing their response", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await declineAfterStarting(page);

  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know, jamie\./i }),
  ).toBeVisible();

  const rows = await declineRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    name: INTAKE.name,
    email: INTAKE.email,
    reason: null,
  });

  expect(await respondentCount()).toBe(1);
  const respondent = await onlyRespondent();
  expect(respondent.name).toBe(INTAKE.name);
  expect(respondent.email).toBe(INTAKE.email);

  // No FK between the two tables — the shared cookie_token is what ties them.
  const { cookie_token } = await respondentIdentity();
  expect(rows[0].cookie_token).toBe(cookie_token);
});

test("undoing a both-rows decline restores welcome back, not a new row", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await declineAfterStarting(page);
  const { created_at: createdBefore } = await respondentIdentity();

  await page.getByRole("button", { name: /actually, i can make it/i }).click();
  // `justCreated` is still true from `completeIntake` earlier in this same
  // visit, so `WelcomeBack` stays suppressed until the next full page load —
  // same as every other "reconsider" path in this suite.
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { name: /welcome back, jamie/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();

  expect(await declineRows()).toEqual([]);
  // Proves the row was reused, not recreated, by the undo.
  const { created_at: createdAfter } = await respondentIdentity();
  expect(createdAfter).toEqual(createdBefore);
});

/** A complete answer that clears every finish check, then Save & finish. */
async function finishFullResponse(page: import("@playwright/test").Page) {
  await pickDestination(page, "summitCounty");
  await page.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  const you = page.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await page.getByRole("button", { name: /save & finish/i }).click();
  await expect(page.getByRole("button", { name: /update my answer/i })).toBeVisible();
}

// §19 decision 10: in direction B, saying "here's my answer" is the undo too.
test("updating the answer after a both-rows decline is the undo", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await finishFullResponse(page);
  await declineAfterStarting(page);
  expect(await declineRows()).toHaveLength(1);

  await page.getByRole("button", { name: /update my answer/i }).click();

  // No reload: the panel has to step aside on the finish reply alone.
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();
  expect(await declineRows()).toEqual([]);
  expect(await respondentCount()).toBe(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: /welcome back, jamie/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();
});

test("an incomplete finish leaves the decline on file", async ({ page }) => {
  await page.goto("/");
  await completeIntake(page);
  await declineAfterStarting(page);

  await page.getByRole("button", { name: /save & finish/i }).click();

  await expect(page.getByRole("alert").filter({ hasText: /almost —/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeVisible();
  expect(await declineRows()).toHaveLength(1);
});
