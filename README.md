# Colorado ski trip planner

A small trip-planning app for a group ski weekend — see [`PLAN.md`](./PLAN.md)
for the full spec and [`mockup.html`](./mockup.html) for the visual reference.

Guests open one page (`/`) to give their availability, destination ranking and
cost inputs, or to say they can't make it. The host sees the rollup at
`/admin`, behind a passcode. Next.js 16 (App Router) on Vercel, Supabase
Postgres via Drizzle. Pushes to `main` deploy straight to production.

## Prerequisites

- **Node 22**, the version CI uses (`.github/workflows/ci.yml`).
- **Docker**, running, for the e2e suite. It starts its own throwaway
  `postgres:16` container unless `DATABASE_URL` is set.

## Development

```bash
npm install
vercel env pull .env.local --environment=development   # brings POSTGRES_URL*
# then add ADMIN_PASSCODE and ADMIN_COOKIE_SECRET to .env.local by hand
npm run dev
```

`vercel env pull` overwrites `.env.local` and drops the two admin secrets,
because they deliberately aren't on the development target. If the correct
passcode is rejected locally, check for them first. See `CLAUDE.md`,
"Environment variables".

## Quality gate

```bash
npm run check   # lint + typecheck + unit tests + e2e tests
```

See `CLAUDE.md` for house style and `PLAN.md` section 14 for the full quality
bar each phase needs to clear. The tests need no env vars or production access.

## Schema changes

`src/db/schema.ts` is the source of truth. Apply a change to production
**before** merging the code that depends on it, since `main` deploys
immediately. Use `npm run db:push` (it targets production unless
`DATABASE_URL` is set) or paste the `drizzle/NNNN_*.sql` file into Supabase's
SQL editor. `PLAN.md` section 12, "Applying schema changes", has the details
and a known gap in the migration files.
