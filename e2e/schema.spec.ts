import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { databaseUrl } from "./database";

/**
 * Supabase's Data API serves every `public` table over REST to anyone holding
 * the anon key, which is public by design — RLS is the only gate. The app
 * never uses that API (it connects as the table owner, which bypasses RLS),
 * so RLS on with no policies closes it off at no cost. Checked against the
 * migration-built schema, so a new table added without `.enableRLS()` fails
 * here rather than shipping readable (PLAN.md section 12).
 */
test("every public table has row-level security enabled", async () => {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    const tables = await sql<{ tablename: string; rowsecurity: boolean }[]>`
      select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename
    `;
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.filter((t) => !t.rowsecurity).map((t) => t.tablename)).toEqual([]);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
