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

## Commands

- `npm run dev` — local dev server
- `npm run check` — lint + typecheck + unit tests + e2e tests (the full gate)
- `npm run lint` / `npm run typecheck` / `npm run test:unit` / `npm run test:e2e`
