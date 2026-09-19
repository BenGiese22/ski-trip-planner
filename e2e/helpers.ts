import postgres from "postgres";
import { expect, type Page } from "@playwright/test";
import { destinations } from "../src/data/destinations";
import { databaseUrl } from "./database";

/**
 * Reads straight from Postgres, so the flow tests can assert what was actually
 * persisted rather than trusting what the page happens to be showing —
 * PLAN.md section 14 asks for the row to be checked, not just the UI.
 */
export async function withDb<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(databaseUrl, { prepare: false, max: 1, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export type StoredRespondent = {
  name: string;
  email: string;
  plus_one: boolean;
  home_airport: string;
  ski_level: string;
  ski_days: number | null;
  already_has_pass: boolean;
  gear_status: string | null;
  plus_one_ski_days: number | null;
  plus_one_gear_status: string | null;
  submitted_at: Date | null;
};

export function onlyRespondent(): Promise<StoredRespondent> {
  return withDb(async (sql) => {
    const rows = await sql<StoredRespondent[]>`select * from respondents`;
    expect(rows).toHaveLength(1);
    return rows[0];
  });
}

export function respondentCount(): Promise<number> {
  return withDb(async (sql) => {
    const [{ count }] = await sql<{ count: string }[]>`select count(*) from respondents`;
    return Number(count);
  });
}

export function availabilityRows(): Promise<{ date: string; status: string }[]> {
  return withDb(
    (sql) =>
      sql<
        { date: string; status: string }[]
      >`select date::text, status from availability order by date`,
  );
}

export function destinationVotes(): Promise<{ destination_slug: string; rank: number }[]> {
  return withDb(
    (sql) =>
      sql<
        { destination_slug: string; rank: number }[]
      >`select destination_slug, rank from destination_votes`,
  );
}

export const INTAKE = {
  name: "Jamie Rivera",
  email: "jamie@example.com",
  airport: "ORD — Chicago",
  skiLevel: "Intermediate",
};

/** Fills and submits the intake form, leaving the page in its "started" state. */
export async function completeIntake(
  page: Page,
  { plusOne = false }: { plusOne?: boolean } = {},
) {
  await page.getByLabel("Your name").fill(INTAKE.name);
  await page.getByLabel("Email").fill(INTAKE.email);
  await page
    .getByLabel("Coming solo or with someone?")
    .selectOption(plusOne ? "true" : "false");
  await page.getByLabel("Home airport").selectOption({ label: INTAKE.airport });
  await page
    .getByLabel("How comfortable are you on snow?")
    .selectOption({ label: INTAKE.skiLevel });

  await page.getByRole("button", { name: /start my response/i }).click();
  // Not the welcome-back header: that's suppressed until the next full page
  // load, so it never appears on the visit that completes intake. The save
  // bar is the signal that the row now exists — it renders off `response`.
  await expect(page.getByRole("button", { name: /save & finish/i })).toBeVisible();
}

export type StoredDecline = {
  name: string | null;
  email: string | null;
  reason: string | null;
  cookie_token: string;
};

export function declineRows(): Promise<StoredDecline[]> {
  return withDb(
    (sql) => sql<StoredDecline[]>`select name, email, reason, cookie_token from declines`,
  );
}

/** The respondent row's identity columns — used to prove a decline undo reuses the row rather than recreating it. */
export function respondentIdentity(): Promise<{ cookie_token: string; created_at: Date }> {
  return withDb(async (sql) => {
    const rows = await sql<
      { cookie_token: string; created_at: Date }[]
    >`select cookie_token, created_at from respondents`;
    expect(rows).toHaveLength(1);
    return rows[0];
  });
}

/**
 * The decline form's own fields — "Your name" labels one in each form, so
 * they're only distinguishable by the fieldset around them (its legend is
 * `DECLINE_FORM_LABEL` in CantMakeIt.tsx).
 */
export const declineForm = (page: Page) =>
  page.getByRole("group", { name: "Can't make it" });

/**
 * Entry point A: expands the "can't make it" disclosure and submits it. The
 * submit button's name is a substring of the disclosure link's, so it's
 * matched exactly rather than by regex.
 */
export async function declineAsFirstTimer(
  page: Page,
  { name, email, reason }: { name: string; email?: string; reason?: string },
) {
  await page.getByRole("button", { name: /can.t make it this time/i }).click();

  const form = declineForm(page);
  await form.getByLabel("Your name").fill(name);
  if (email !== undefined) await form.getByLabel("Email (optional)").fill(email);
  if (reason !== undefined) {
    await form.getByLabel(/anything you want ben to know/i).fill(reason);
  }
  await form.getByRole("button", { name: "Let Ben know", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeVisible();
}

/**
 * Entry point B: a respondent row already exists, so this only asks for a
 * reason. Same fieldset legend as entry point A — the two forms never render
 * at once, so `declineForm` still scopes to the right one.
 */
export async function declineAfterStarting(page: Page, { reason }: { reason?: string } = {}) {
  await page.getByRole("button", { name: /can.t make it after all/i }).click();

  const form = declineForm(page);
  if (reason !== undefined) {
    await form.getByLabel(/anything you want ben to know/i).fill(reason);
  }
  await form.getByRole("button", { name: "Let Ben know", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /thanks for letting ben know/i }),
  ).toBeVisible();
}

/** The grid labels days as "Thursday, January 28 — not set". */
export function dayCell(page: Page, label: string) {
  return page.getByRole("button", { name: new RegExp(`^${label} —`) });
}

/**
 * Destinations are ranked rather than picked. Drives the up button — the
 * keyboard-accessible path — until the named destination sits first, which is
 * what the cost estimate follows.
 */
export async function pickDestination(page: Page, slug: string) {
  // The real display names are long ("Summit County — Frisco, Dillon,
  // Silverthorne"), so match the aria-label loosely rather than assuming a
  // short name — a too-strict regex silently matched nothing and fell through
  // to accepting the default order.
  const name = destinations.find((d) => d.slug === slug)!.name;
  for (let i = 0; i < 4; i++) {
    const up = page.getByRole("button", { name: `Move ${name} up`, exact: false });
    if (!(await up.isVisible()) || !(await up.isEnabled())) break;
    await up.click();
  }

  // Already top of the default order: nothing moved, so nothing was committed.
  // Accepting the order explicitly is how a real user expresses the same thing.
  const accept = page.getByRole("button", { name: /this order works for me/i });
  if (await accept.isVisible()) await accept.click();
  // Assert via the rank badge, not list position: the destination cards
  // contain their own <li> bullets, so getByRole("listitem") matches those too.
  await expect(page.getByTestId(`rank-badge-${slug}`)).toHaveText("1st choice");
}


