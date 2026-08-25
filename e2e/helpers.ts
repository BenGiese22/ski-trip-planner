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
  await expect(page.getByRole("heading", { name: /welcome back, jamie/i })).toBeVisible();
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


