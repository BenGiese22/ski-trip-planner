import { execFileSync } from "node:child_process";
import postgres from "postgres";

/**
 * A throwaway Postgres for the e2e suite. Production Supabase is never touched
 * by a test run (PLAN.md section 16, decision 5) — the app's DB client prefers
 * DATABASE_URL, which is what points it here.
 *
 * The port and credentials are fixed rather than discovered so the connection
 * string is known at config load time, which means the web server can be handed
 * it without depending on what order Playwright starts its pieces in.
 */
export const CONTAINER_NAME = "ski-trip-e2e-pg";
export const TEST_DATABASE_URL = "postgres://ski:pw@localhost:54329/skitest";

/**
 * Set DATABASE_URL yourself to point the suite at an existing Postgres — a CI
 * service container, say — and container management is skipped entirely.
 */
export const managesOwnDatabase = !process.env.DATABASE_URL;

export const databaseUrl = process.env.DATABASE_URL ?? TEST_DATABASE_URL;

function docker(args: string[], options: { allowFailure?: boolean } = {}) {
  try {
    return execFileSync("docker", args, { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    if (options.allowFailure) return "";
    throw error;
  }
}

export function startDatabase(): void {
  // A container left behind by an interrupted run would otherwise collide.
  docker(["rm", "-f", CONTAINER_NAME], { allowFailure: true });

  docker([
    "run",
    "-d",
    "--name",
    CONTAINER_NAME,
    "-p",
    "54329:5432",
    "-e",
    "POSTGRES_PASSWORD=pw",
    "-e",
    "POSTGRES_USER=ski",
    "-e",
    "POSTGRES_DB=skitest",
    "postgres:16",
  ]);

  const deadline = Date.now() + 60_000;
  for (;;) {
    const ready = docker(["exec", CONTAINER_NAME, "pg_isready", "-U", "ski", "-d", "skitest"], {
      allowFailure: true,
    });
    if (ready.includes("accepting connections")) return;
    if (Date.now() > deadline) {
      throw new Error("Test Postgres did not become ready within 60s");
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
}

export function stopDatabase(): void {
  docker(["rm", "-f", CONTAINER_NAME], { allowFailure: true });
}

export function pushSchema(url: string): void {
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

/**
 * Between specs, so one test's state can't be seen by the next. Goes through
 * the driver rather than `docker exec psql`, so it works just as well against
 * a Postgres this file didn't start.
 *
 * `rate_limits` has to be named explicitly: it deliberately has no foreign key
 * to respondents (rate limiting must work for callers with no respondent row),
 * so `cascade` doesn't reach it. Without this, limiter state leaks between
 * tests — the admin spec alone spends exactly the login allowance, so a
 * Playwright retry would start already throttled and fail for a reason that
 * looks nothing like the cause.
 */
export async function truncateAll(url: string): Promise<void> {
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await sql`truncate respondents, rate_limits cascade`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Admin credentials for the e2e suite only. Committed on purpose: they gate
 * nothing but the throwaway container this file starts, and hardcoding them
 * keeps a test run from depending on whatever happens to be in .env.local.
 * These must never be the real production values.
 */
export const TEST_ADMIN_PASSCODE = "e2e-passcode-not-a-secret";
export const TEST_ADMIN_COOKIE_SECRET = "e2e-cookie-secret-not-a-secret";
