import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * DATABASE_URL wins when set, which is how local and CI test runs point at a
 * throwaway Postgres instead of production Supabase (PLAN.md section 16,
 * decision 5). Otherwise fall back to what the Supabase integration puts on
 * the Vercel project.
 */
export function resolveConnectionString(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.DATABASE_URL ?? env.POSTGRES_URL;
}

// Next.js re-imports modules on every hot reload in dev, and each import would
// otherwise open a fresh pool. Stash the client on globalThis so it survives.
const globalForDb = globalThis as unknown as {
  __skiTripDb?: Database;
  __skiTripSql?: postgres.Sql;
};

function createClient(): Database {
  const connectionString = resolveConnectionString();

  if (!connectionString) {
    throw new Error(
      "No database connection string. Set DATABASE_URL (local/CI) or POSTGRES_URL " +
        "(Supabase, injected by Vercel). If `vercel env pull` left POSTGRES_URL out of " +
        ".env.local, the variable is scoped to production/preview only — add " +
        "'development' to its target list and pull again. See PLAN.md section 12.",
    );
  }

  // Supabase's pooled connection is pgbouncer in transaction mode, which does
  // not support prepared statements. Harmless against a plain Postgres too.
  const sql = postgres(connectionString, { prepare: false });
  const db = drizzle(sql, { schema });

  globalForDb.__skiTripSql = sql;
  globalForDb.__skiTripDb = db;
  return db;
}

/**
 * Resolved lazily rather than at import time so that importing anything in the
 * db module (types, schema) doesn't require a live connection string — which
 * matters during `next build` and in unit tests.
 */
export function getDb(): Database {
  return globalForDb.__skiTripDb ?? createClient();
}
