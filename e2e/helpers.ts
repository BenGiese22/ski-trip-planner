import postgres from "postgres";
import { expect, type Page } from "@playwright/test";
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
 * The destination preference now lives on each card as a toggle rather than in
 * a dropdown, so choosing is scoped to the card.
 */
export async function pickDestination(page: Page, slug: string) {
  await page
    .getByTestId(`destination-${slug}`)
    .getByRole("button", { name: /prefer this one/i })
    .click();
  await expect(
    page.getByTestId(`destination-${slug}`).getByRole("button", { name: /this is my pick/i }),
  ).toBeVisible();
}
