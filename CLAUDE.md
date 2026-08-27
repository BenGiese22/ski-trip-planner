# Colorado ski trip planner

See `PLAN.md` for the full spec: architecture, data model, phased build order,
and the quality bar (section 14). `mockup.html` is the visual/design reference
— layout and copy tone are accurate, but treat any JS in it as throwaway, not
something to reuse.

## House style

- **Package manager**: npm. Don't introduce pnpm/yarn.
- **Branching**: trunk-based off `main` — `main` is what ships. Feature work
  goes on a `bgiese/`-prefixed branch cut from `origin/main` and merges back
  via PR (`/pr`, assigned to BenGiese22). Phase 2 onward follows this; Phases
  0–1 predate it and were committed directly to
  `claude/ski-trip-web-app-445iaa`.
- **Commits**: Conventional Commits syntax, subject under 50 chars. Commit at
  natural checkpoints — end of each red/green/refactor cycle, end of each
  phase — with clear, descriptive messages. Prefer several reviewable commits
  over one large diff.
- **TDD** for anything that computes or transforms data (cost calculator,
  availability aggregation, date/blackout logic, session/cookie resolution):
  write the failing test first, confirm it fails for the right reason, then
  implement. Static content (destination cards, hero copy) gets visual review
  instead, not a unit test.
- **Quality gate**: `npm run check` (lint, typecheck, unit tests, e2e tests)
  must be green before a phase counts as done — see PLAN.md section 14.
- **Plan mode** for the first pass of every phase in PLAN.md section 11, even
  once a phase is underway and auto mode is handling routine edits within it.
- Database is **Supabase Postgres**, not Vercel Postgres/Neon as originally
  drafted in PLAN.md section 4 — noted inline there. Everything else in the
  data model (section 5) applies as written.

## Environment variables

Production is the only environment that matters here — there are no preview
or development deploys to keep in sync, and pushes to `main` deploy straight
to production.

- `ADMIN_PASSCODE` and `ADMIN_COOKIE_SECRET` live in **Vercel Production and
  in `.env.local` only**, on purpose. Don't add them to the preview or
  development environments.
- **`vercel env pull` overwrites `.env.local`.** Because the two admin secrets
  aren't on the development target, a pull silently drops them, and `npm run
  dev` then rejects the correct passcode — which reads as a wrong password
  rather than missing config. If you pull, re-add both lines afterwards.
- `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` *are* on the development target,
  which is the only reason `vercel env pull` can retrieve them at all — see
  PLAN.md section 12 for why sensitive vars are otherwise unreadable.
- Tests need none of this: the e2e suite supplies its own committed throwaway
  passcode and cookie secret, and runs against a throwaway Postgres.

## Commands

- `npm run dev` — local dev server
- `npm run check` — lint + typecheck + unit tests + e2e tests (the full gate)
- `npm run lint` / `npm run typecheck` / `npm run test:unit` / `npm run test:e2e`
