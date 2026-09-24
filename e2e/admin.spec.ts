import { expect, test } from "@playwright/test";
import { TEST_ADMIN_PASSCODE, databaseUrl, truncateAll } from "./database";
import {
  completeIntake,
  declineAfterStarting,
  declineAsFirstTimer,
  pickDestination,
} from "./helpers";

test.beforeEach(async () => {
  await truncateAll(databaseUrl);
});

const passcodeField = "Passcode";
const submit = /show me the responses/i;

test("the dashboard is hidden until the passcode is given", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByLabel(passcodeField)).toBeVisible();
  await expect(page.getByTestId("admin-dashboard")).toBeHidden();
  // Nothing about anyone's response should reach the page before the gate.
  await expect(page.getByRole("button", { name: /sign out/i })).toBeHidden();
});

test("a wrong passcode is refused and sets no cookie", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel(passcodeField).fill("definitely-not-it");
  await page.getByRole("button", { name: submit }).click();

  await expect(page.getByText(/incorrect passcode/i)).toBeVisible();
  await expect(page.getByTestId("admin-dashboard")).toBeHidden();

  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "ski_trip_admin")).toBeUndefined();
});

test("the right passcode opens the dashboard", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();

  await expect(page.getByTestId("admin-dashboard")).toBeVisible();
  await expect(page.getByLabel(passcodeField)).toBeHidden();
});

test("the admin cookie is httpOnly and scoped to /admin", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  const cookie = (await page.context().cookies()).find((c) => c.name === "ski_trip_admin");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  // Scoped so it is never attached to a guest's page load.
  expect(cookie?.path).toBe("/admin");
  expect(await page.evaluate(() => document.cookie)).not.toContain("ski_trip_admin");
});

test("the session survives a reload, and sign out ends it", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByLabel(passcodeField)).toBeVisible();
  await expect(page.getByTestId("admin-dashboard")).toBeHidden();
});

// The admin cookie must not double as a guest identity, or vice versa.
test("an admin session grants no guest identity", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: /start my response/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeHidden();
});

// §14 puts throttling in this phase specifically, on the route with the
// actual sensitive surface.
test("repeated wrong passcodes get rate limited", async ({ page, request }) => {
  await page.goto("/admin");

  // Drive the API directly: the limit is per-IP per window, and going through
  // the form would just be a slower way to make the same six requests.
  let sawLimit = false;
  for (let i = 0; i < 8; i++) {
    const res = await request.post("/api/admin/login", {
      data: { passcode: `wrong-${i}` },
      failOnStatusCode: false,
    });
    if (res.status() === 429) {
      sawLimit = true;
      expect(res.headers()["retry-after"]).toBeTruthy();
      break;
    }
    expect(res.status()).toBe(401);
  }
  expect(sawLimit).toBe(true);

  // And the correct passcode is refused too while the window is open —
  // otherwise the limit would be trivially bypassed by guessing correctly.
  const afterLimit = await request.post("/api/admin/login", {
    data: { passcode: TEST_ADMIN_PASSCODE },
    failOnStatusCode: false,
  });
  expect(afterLimit.status()).toBe(429);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel(passcodeField).fill(TEST_ADMIN_PASSCODE);
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();
  // router.refresh() can leave the form mounted for a beat; wait it out so
  // assertions never race the swap.
  await expect(page.getByLabel(passcodeField)).toBeHidden();
}

test("with no responses the dashboard says so instead of showing an empty grid", async ({
  page,
}) => {
  await signIn(page);

  await expect(page.getByText(/nobody.s finished a response yet/i)).toBeVisible();
});

// A decline before anyone finishes intake still has to surface somewhere —
// otherwise Ben sees "nobody's responded" and has no idea one person already
// answered, just in the negative.
test("a decline before anyone finishes shows up in the empty state", async ({
  page,
  browser,
}) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await declineAsFirstTimer(guestPage, { name: "Sam Lee" });
  await guest.close();

  await signIn(page);

  await expect(page.getByText(/nobody.s finished a response yet/i)).toBeVisible();
  await expect(page.getByText(/1 person has said they can.t make it/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /when the group can go/i }),
  ).toBeHidden();
});

// Section 17 decision 3: only finished responses move the numbers.
test("an unfinished response is not counted", async ({ page, browser }) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await completeIntake(guestPage);
  await guestPage.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  // Deliberately no "Save & finish".
  await guest.close();

  await signIn(page);
  await expect(page.getByText(/nobody.s finished a response yet/i)).toBeVisible();
});

test("a finished response shows up in the heatmap", async ({ page, browser }) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await completeIntake(guestPage);
  await pickDestination(guestPage, "summitCounty");
  await guestPage.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  const you = guestPage.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await guestPage.getByRole("button", { name: /save & finish/i }).click();
  await expect(guestPage.getByRole("button", { name: /update my answer/i })).toBeVisible();
  await guest.close();

  await signIn(page);

  await expect(page.getByText(/1 person has finished/i)).toBeVisible();
  // The quick pick marked Jan 28-31 available, so those days carry a count
  // and the accessible label states it without relying on the shading.
  await expect(
    page.getByLabel(/Thursday, January 28 — 1 available/),
  ).toBeVisible();
  await expect(page.getByLabel(/Tuesday, February 2 — nobody yet/)).toBeVisible();
});

// §19 decision 10: finishing again after a direction-B decline is the undo,
// so admin has to count the guest again.
test("a guest who finishes again is counted again", async ({ page, browser }) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await completeIntake(guestPage);
  await pickDestination(guestPage, "summitCounty");
  await guestPage.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  const you = guestPage.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await guestPage.getByRole("button", { name: /save & finish/i }).click();
  await expect(guestPage.getByRole("button", { name: /update my answer/i })).toBeVisible();

  await declineAfterStarting(guestPage);
  await guestPage.getByRole("button", { name: /update my answer/i }).click();
  await expect(
    guestPage.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();
  await guest.close();

  await signIn(page);

  await expect(page.getByText(/1 person has finished/i)).toBeVisible();
  await expect(page.getByText(/can.t make it/i)).toBeHidden();
});

test("the tally lists every destination, including ones nobody picked", async ({
  page,
  browser,
}) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await completeIntake(guestPage);
  await pickDestination(guestPage, "steamboat");
  await guestPage.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  const you = guestPage.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: "2 days" }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await guestPage.getByRole("button", { name: /save & finish/i }).click();
  await expect(guestPage.getByRole("button", { name: /update my answer/i })).toBeVisible();
  await guest.close();

  await signIn(page);

  // The top-ranked one shows its count and share...
  await expect(page.getByText(/1 first choice · 100%/)).toBeVisible();
  // ...and the two nobody put first are still listed, rather than vanishing.
  await expect(page.getByText(/0 first choices/)).toHaveCount(2);
  await expect(page.getByText("Winter Park", { exact: true })).toBeVisible();
  // Ranking's payoff: the full spread, not just the headline count.
  await expect(page.getByText(/average rank/).first()).toBeVisible();
});

test("the cost rollup prices each person and totals the group", async ({
  page,
  browser,
}) => {
  // Two guests, different airports and destinations, one bringing a plus-one —
  // so the total genuinely has to span people rather than echo one row.
  const guests = [
    { name: "Ana", airport: "SFO", dest: "steamboat", plusOne: false },
    { name: "Cara", airport: "ORD", dest: "summitCounty", plusOne: true },
  ];

  // Cara's context stays open past the loop — a later scenario has her
  // decline through it (entry point B needs her existing cookie/session).
  let caraPage: import("@playwright/test").Page | undefined;

  for (const g of guests) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto("/");
    await p.getByLabel("Your name").fill(g.name);
    await p.getByLabel("Email").fill(`${g.name.toLowerCase()}@example.com`);
    await p.getByLabel("Coming solo or with someone?").selectOption(String(g.plusOne));
    await p.getByLabel("Home airport").selectOption(g.airport);
    await p.getByLabel("How comfortable are you on snow?").selectOption("intermediate");
    await p.getByRole("button", { name: /start my response/i }).click();
    await expect(p.getByRole("button", { name: /save & finish/i })).toBeVisible();

    await pickDestination(p, g.dest);
    await p.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();

    const you = p.getByRole("group", { name: "You", exact: true });
    await you.getByRole("button", { name: "2 days" }).click();
    await you.getByRole("button", { name: /i need gear/i }).click();
    if (g.plusOne) {
      const partner = p.getByRole("group", { name: "Your plus-one" });
      await partner.getByRole("button", { name: "2 days" }).click();
      await partner.getByRole("button", { name: /bringing their own gear/i }).click();
    }
    await p.getByRole("button", { name: /save & finish/i }).click();
    await expect(p.getByRole("button", { name: /update my answer/i })).toBeVisible();
    if (g.name === "Cara") caraPage = p;
    else await ctx.close();
  }

  await signIn(page);

  // Both people listed, each against their own airport and destination.
  await expect(page.getByText("Ana", { exact: true })).toBeVisible();
  await expect(page.getByText(/SFO · Steamboat Springs/)).toBeVisible();
  await expect(page.getByText(/ORD · Summit County/)).toBeVisible();

  // Three people across two rows — the plus-one has to count.
  await expect(page.getByText(/3 people/)).toBeVisible();
  await expect(page.getByText(/Everyone, together/)).toBeVisible();
  // Both guests' quick-picked days land on the same date — both count.
  await expect(page.getByLabel(/Thursday, January 28 — 2 available/)).toBeVisible();

  // Cara declines afterward (entry point B) — her respondent row stays in
  // the database, but every admin aggregate should drop her outright.
  await declineAfterStarting(caraPage!, { reason: "can't make it after all" });

  await page.reload();
  await expect(page.getByText(/1 person has finished.*1 can.t make it/)).toBeVisible();
  await expect(page.getByText("Ana", { exact: true })).toBeVisible();
  await expect(page.getByText("Cara", { exact: true })).toBeHidden();
  await expect(page.getByLabel(/Thursday, January 28 — 1 available/)).toBeVisible();
  // The tally reverts to Ana's own choice; Summit County drops back to zero.
  await expect(page.getByText(/1 first choice · 100%/)).toBeVisible();
  await expect(page.getByText(/0 first choices/)).toHaveCount(2);
  // The rollup is Ana alone now — no plus-one, so it's "1 person", not "3".
  await expect(page.getByText(/\(1 person\)/)).toBeVisible();

  // Undo the decline through the UI, exactly as a guest changing their mind
  // would — the same context, cookie, and page that submitted it. "Update my
  // answer" is a bad signal to wait on here: the save bar renders it
  // regardless of decline state, so it's already visible before the click.
  // The decline banner disappearing is what actually tracks the undo.
  await caraPage!.getByRole("button", { name: /actually, i can make it/i }).click();
  await expect(
    caraPage!.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeHidden();
  await caraPage!.context().close();

  await page.reload();
  await expect(page.getByText(/2 people have finished/i)).toBeVisible();
  await expect(page.getByText(/can.t make it/i)).toBeHidden();
  await expect(page.getByText("Ana", { exact: true })).toBeVisible();
  // Cara has a plus-one, so her row's text is "Cara +1" — not an exact match.
  await expect(page.getByText("Cara", { exact: false })).toBeVisible();
  await expect(page.getByText(/3 people/)).toBeVisible();
  await expect(page.getByLabel(/Thursday, January 28 — 2 available/)).toBeVisible();
});

// Section 17 decision 6: the assumption must be visible in Ben's view too, or
// he reads an estimated figure as a stated one.
test("a pass holder's assumption is flagged in the rollup", async ({ page, browser }) => {
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/");
  await completeIntake(guestPage);
  await pickDestination(guestPage, "summitCounty");
  await guestPage.getByRole("button", { name: /Thu Jan 28 – Sun Jan 31/ }).click();
  const you = guestPage.getByRole("group", { name: "You", exact: true });
  await you.getByRole("button", { name: /i already have a pass/i }).click();
  await you.getByRole("button", { name: /i need gear/i }).click();
  await guestPage.getByRole("button", { name: /save & finish/i }).click();
  await expect(guestPage.getByRole("button", { name: /update my answer/i })).toBeVisible();
  await guest.close();

  await signIn(page);
  await expect(page.getByText("est.", { exact: true })).toBeVisible();
  await expect(page.getByText(/assumed 2 ski days/i)).toBeVisible();
});
