import { defineConfig } from "drizzle-kit";

// Schema pushes go over a direct connection, not the pgbouncer pool — DDL and
// pooling in transaction mode don't mix. DATABASE_URL wins so that pushes
// against the throwaway test Postgres work the same way (PLAN.md section 16,
// decision 5); POSTGRES_URL_NON_POOLING is Supabase's direct connection.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING;

if (!url) {
  throw new Error(
    "drizzle-kit needs DATABASE_URL (local/CI) or POSTGRES_URL_NON_POOLING " +
      "(Supabase). The latter is a sensitive Vercel env var that `vercel env pull` " +
      "cannot retrieve — copy it from the Supabase dashboard into .env.local. " +
      "See PLAN.md section 12.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
