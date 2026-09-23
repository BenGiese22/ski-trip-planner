# Colorado ski trip planner — implementation plan

**Purpose of this doc:** hand this to Claude Code as the spec for building the real app. It covers what to build, the data model, the tricky UX decisions (flexible dates, cost transparency, returning visitors), and a phased build order. Drop this file in the repo root (e.g. `PLAN.md`) and point Claude Code at it.

**Purpose of this page, stated plainly (should be up top in the real app, not just implied):** this is an early-stage interest and scheduling check, not a booked trip. The job is to find out who's actually interested and which dates could realistically work — not to sell anyone on a finished plan. Keep the copy throughout the app matched to that: tentative, inviting responses rather than announcing decisions.

**Trip context:** a Colorado ski weekend sometime in the mid-January to mid-March 2027 window (snow reliability is the main driver of that range). Ben and Megan already hold the Ikon Base Pass, which is why the destination shortlist is built around resorts that pass already covers — other guests aren't assumed to have any pass, and will most likely buy a short, multi-day Ikon Session Pass sized to however many days they actually ski (see section 8). Group size and the actual send list aren't finalized — likely a friend group skewing toward couples, mixed ski ability, home airports SFO / ORD / MKE / MSP — so don't hardcode a headcount anywhere in the UI or copy (see note below). Candidate destinations: Steamboat Springs, Summit County (Copper Mountain), Winter Park.

One scheduling note, worth keeping as a minor aside rather than the trip's framing: the window under consideration happens to land around Ben's birthday (Feb 1, a Monday). That's a nice bonus if the dates line up, not the reason for the trip — the hero copy and section intros in the mockup treat it that way deliberately, and any content Claude Code writes should follow the same tone rather than leading with it.

---

## 1. What this app actually needs to do

Two audiences, two jobs:

1. **Friends (guests)** — understand the trip idea, browse destination options (town + skiing + food + activities, not just terrain stats), see roughly what it'll cost them, tell Benjamin when they can go and what they'd prefer, and be able to come back later and see or edit what they submitted.
2. **Benjamin (host)** — see all responses in one place: who's in, availability overlap across the group, destination preference tally, and enough cost data to make a real decision.

Non-goals: no payments, no real-time flight price scraping, no account system with passwords. This is a small, trusted-group planning tool, not a product.

---

## 2. Content model: place-first, not mountain-first

The first mockup organized everything around "pick a mountain" with terrain difficulty bars. Feedback was clear: most of this group doesn't ski often enough to have an opinion on terrain — they care about the town, the food, the shopping, and the vibe, with skiing as one input among several.

Restructure content around **destination bundles**, not resorts:

- **Steamboat Springs** (mountain: Steamboat) — full resort town, Old Town Hot Springs + Strawberry Park Hot Springs, walkable brewery/dining row on Lincoln Ave, furthest to reach, Ikon Base capped at 5 days with blackout dates there.
- **Summit County** (mountain: Copper Mountain) — Frisco / Dillon / Silverthorne, unlimited on Ikon Base, cheapest lodging inventory, closest to DEN, outlet mall, less of a single walkable center.
- **Winter Park** (mountain: Winter Park) — closest mountain to Denver, unlimited on Ikon Base, small low-key main street, tubing hill for non-skiers, fewer dining/shopping options than the other two.

Each bundle should carry the **same fields** so they render as comparable cards, not as an arbitrary list:

```
{
  slug, name, mountain, passAccess: "unlimited" | "5-day, blackout dates",
  driveTimeFromDenver, directFlightAirport?: "HDN" | null,
  skiSummary, townSummary, foodAndDrink, shopping, otherActivities,
  costRangePerPerson: [low, high],
  sources: [{ label, url }]   // see section 9
}
```

Keep this as structured data (a `destinations.ts` or a DB table seeded once), not prose baked into JSX — it needs to be editable without touching layout code, and it's the thing that goes stale fastest (prices, blackout dates, flight schedules).

Widen `foodAndDrink` and `otherActivities` beyond one-line summaries — feedback on the first pass was that these were too thin. Each destination should carry a short list of specific, named restaurants/breweries/activities, not just a genre description ("a brewery scene"). This is real research to do per destination (see section 13) rather than something to fill with placeholders at launch — plan on an actual pass through each town's current dining scene before this goes in front of the group. `driveTimeFromDenver` should render on every destination card as a static, hardcoded estimate (no live traffic API needed): Steamboat ≈3h15, Summit County/Copper ≈1h45, Winter Park ≈1h20 via US-40.

**Presentation matters here too.** The first version of these cards read as dense paragraph blocks and got called out for it. Render each destination's detail as four short, labeled tiles — on the mountain / getting around / food & town / off the snow — each holding 2–3 bullet points, not prose paragraphs. That structure should live in the data shape itself (an array of `{ tileLabel, bullets: string[] }` per destination, four entries) rather than being reassembled from a single long description field at render time — it's easier to keep each bullet short if the schema doesn't invite writing a paragraph into one field.

---

**On the hero visual:** the mockup replaced the flat pine-green header with an original, flat SVG mountain-range graphic (layered triangular ridgelines plus a small sun accent) rather than a stock photo. Keep it that way in the real build — it matches the flat, mono-accented visual language used throughout the rest of the page, needs no image licensing or hosting, and renders instantly with no loading state. If a real photo ever feels worth it later, that's a deliberate swap to make once, not a placeholder to fill in now.

## 3. Core user flows

**Guest, first visit**
Landing → short intake (name, plus-one or solo, **home airport**, ski ability) → destination cards → availability calendar → **flights, personalized to the home airport just given** → cost estimate → optional notes → submit. On submit, set a persistent identity cookie (see section 6) so they're recognized on return.

Home airport is captured in the intake step specifically so the "getting there" content later in the flow can skip the airport-picker UI entirely and just show the one relevant card — no one needs to read about the other two cities' flight options. This also means "getting there" depends on intake having already run, so it can't be the first thing on the page; it belongs after destinations and dates, once the respondent's context is known.

**Guest, return visit**
Cookie recognized → show "welcome back, here's what you told us" with their answers pre-filled and editable, plus the reference content (destinations, cost breakdown, flight links) still browsable underneath, same as a first-time visitor.

**Guest, can't attend**
Bowing out before ever starting intake swaps in a short name/email/reason form instead of the destination-and-dates flow; bowing out after already answering just asks for a reason, since name and email are already on file. Either way the same cookie mechanism recognizes them on return and shows the decline as already on file, same as any other saved answer.

**Benjamin, admin view**
A separate, lightly protected route (`/admin`) showing: response count, an availability heatmap across the whole candidate date range, a destination preference tally, and a per-person cost estimate table driven by each guest's stated airport and ski-ability inputs.

---

## 4. Tech stack

- **Next.js (App Router) + TypeScript**, deployed to Vercel — matches your existing workflow.
- **Tailwind** for styling.
- **Vercel Postgres** (Neon-backed) for storage. At this scale (dozens of rows) the free tier is more than enough — no need for KV or anything fancier. **[Update, Phase 0]:** the actual project uses **Supabase Postgres** instead (already provisioned and connected to the Vercel project) — same relational-Postgres shape, so the schema in section 5 and the Drizzle setup are unaffected; only the connection string source changes (Supabase, not Neon/Vercel Postgres env vars).
- **Drizzle ORM** over Prisma: lighter weight, no codegen step, easier for an agent to read and modify a schema file directly. Prisma is a fine alternative if you'd rather have its tooling.
- **Zod** for validating the intake form and API route payloads server-side (not just client-side) — matters here since anyone with the link can hit the API.

No auth library needed. See section 6 for how identity works without one.

---

## 5. Data model

```sql
-- one row per person who has submitted or partially filled the form
create table respondents (
  id            uuid primary key default gen_random_uuid(),
  cookie_token  uuid not null unique,        -- matches the httpOnly cookie, see section 6
  name          text not null,
  email         text not null,               -- added in Phase 2, section 16 decision 8
  plus_one      boolean not null default false,
  home_airport  text not null,               -- 'SFO' | 'ORD' | 'MKE' | 'MSP'
  ski_level     text not null,               -- 'beginner' | 'intermediate' | 'advanced'
  ski_days      int,                         -- 1, 2, or 3 — null if "already have a pass"
  already_has_pass boolean not null default false,
  gear_status   text,                        -- 'own' | 'rental'
  plus_one_ski_days int,                     -- same scale, only meaningful when plus_one = true
  plus_one_already_has_pass boolean not null default false,
  plus_one_gear_status text,                 -- 'own' | 'rental', only meaningful when plus_one = true
  notes         text,
  submitted_at  timestamptz,                 -- null while in progress, set when they hit "Save & finish"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- one row per (respondent, date) for the availability grid
create table availability (
  respondent_id uuid not null references respondents(id) on delete cascade,
  date          date not null,
  status        text not null,               -- 'available' | 'maybe' | 'unavailable'
  primary key (respondent_id, date)
);

-- one row per respondent's destination ranking/preference
create table destination_votes (
  respondent_id   uuid not null references respondents(id) on delete cascade,
  destination_slug text not null,
  rank            int not null,              -- 1 = first choice
  primary key (respondent_id, destination_slug)
);

-- one row per browser that has said "can't make it" — independent of
-- respondents, so it works for someone who never started intake
create table declines (
  id            uuid primary key default gen_random_uuid(),
  cookie_token  uuid not null unique,        -- same cookie as respondents.cookie_token, when both exist
  name          text,
  email         text,
  reason        text,
  created_at    timestamptz not null default now()
);

-- fixed-window rate limiter for the guest write endpoints and admin login
-- (Phase 3); no foreign key, so it works for callers with no respondent row
create table rate_limits (
  bucket_key    text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (bucket_key, window_start)
);
```

**[Update, post-decline]:** `src/db/schema.ts` is the authoritative schema; the block above mirrors it as of the decline feature (section 19). `home_airport` and `ski_level` are `NOT NULL` because no row exists until intake is complete (section 16, decision 7). See section 12, "Applying schema changes", for how a change here reaches production.

Destinations, cost assumptions, and Ikon pass facts can stay as static structured data in the codebase (section 2) rather than DB tables — they change once a season, not per user, and keeping them in version control makes it obvious when they were last checked.

---

## 6. Identity, cookies, and the database — how they fit together

You asked directly whether this can be done with cookies. Short answer: **cookies handle "remember this browser," the database handles "remember the data."** They do different jobs and you need both.

- A cookie alone is not durable or queryable storage. It lives on one guest's device, disappears if they clear it or switch phones, and you (Benjamin) can never see it from your side. It's the wrong place to store the actual RSVP data.
- What a cookie is good for here: on first submit, generate a random UUID server-side, store it as an **httpOnly, secure cookie** on the guest's browser, and save that same UUID on their `respondents` row (`cookie_token` above). Next time that browser hits the site, the server reads the cookie, looks up the matching row, and shows them their own answers — pre-filled, editable — without any login form. This is exactly the pattern needed for "let them come back and see what they told us" without building real authentication.
- The **source of truth stays in Postgres**. That's what makes it queryable for your admin view, and what makes it survive someone clearing cookies or opening the link on a different device (in which case they'd just start a fresh response — acceptable for a group this size; if it happens you can manually merge in the DB).
- For the `/admin` route, you don't need a real auth system either — a shared secret is enough. Simplest version: a `ADMIN_PASSCODE` env var, a single password field, and a signed cookie on success. Slightly more robust: Vercel's built-in Deployment Protection / password protection on that one route if you want to avoid writing any auth code at all.

### Autosave vs. the "Save & finish" button

These are two different mechanisms, worth keeping separate:

- **Autosave** happens continuously and silently. Debounce each field (~600–800ms after the person stops typing, or immediately on blur/select-change for dropdowns and the calendar grid) and `PATCH` the respondent row via `/api/respondents`. This is what makes "close the tab and come back later" work — nothing depends on the person finding and clicking a button first. A small status indicator ("saved just now") is enough UI; it doesn't need to block anything.
- **"Save & finish"** is a distinct, explicit action that sets `submitted_at`. It's not what makes the data durable — autosave already did that — it's a clear endpoint that (a) tells the person "you're done, this counts," and (b) gives Benjamin's admin view a clean way to distinguish "actively filling this out" from "considers their answer final" when tallying responses. Keep the button visible throughout the flow (a fixed bar at the bottom works well) rather than only at the very end, since someone might reasonably decide they're done after just the destination and date sections without scrolling through the cost calculator.
- Don't gate autosave on validation the way a real form submit would — an incomplete row is fine to have sitting in the database mid-session. Validate (via the Zod schemas from section 4) only at the "Save & finish" step, where it's fair to ask the person to fill in anything required before it counts as submitted.

---

## 7. The availability picker (the part worth getting right)

The original 3-radio-button version doesn't work for someone like a teacher whose availability doesn't line up with a preset weekend, and the first grid mockup only covered ~9 days, which isn't enough runway. Use the pattern from tools like When2meet/Doodle, scoped to the full realistic window:

- Render three month grids spanning **mid-January through mid-March 2027** specifically — Jan 16 through Mar 15 — not the full quarter. Ben narrowed this deliberately: snow is typically most reliable in that stretch. (The window also happens to sit around the birthday, which is worth a light aside in the UI copy — see the tone note in section 1 — but shouldn't be presented as the reason for the range; snow quality is.) Render January and March as their real calendar grids (correct weekday alignment) with the out-of-window days (Jan 1–15, Mar 16–31) shown as blank, unlabeled cells rather than omitted rows — that keeps the weekday columns honest without inviting a click on a day that was never actually on the table.
- Each guest taps through their own days: available / maybe / unavailable (3-state toggle, default unset). A full quarter is ~90 toggle-able cells, which is fine for a click-through grid but means the UI needs a low-friction interaction — click-and-drag to paint a range of days as "available" in one gesture, not 90 individual clicks.
- Keep the 3 quick-pick presets above the grid as a fast path that bulk-sets the relevant days to "available" — most people will use this and never touch the grid directly. The grid is there for the exceptions, and for anyone who wants to flag a second, backup window.
- Mark the known Ikon Base/Session Pass blackout dates directly on the grid (Jan 16–17, 2027; Feb 13–14, 2027 both fall inside this trimmed window) as a visibly different state — not selectable as "available" if Steamboat is the chosen destination, since those days simply don't work there.
- Store one `availability` row per (respondent, date), same schema as before — a teacher's actual availability might be non-contiguous (free Thu/Fri, unsure about the weekend, free again Monday), and per-day rows handle that without extra modeling even across a 90-day window.
- On the admin view, aggregate into a heatmap across all three months: count of "available" per day across all respondents, colored by density. That's the view that actually tells Benjamin which window has the best overlap — it's more useful than any individual person's answer, and it's the thing that makes scanning three months of grid actually fast instead of tedious.

---

## 8. Cost calculator

**Important correction from earlier passes:** the first version priced everyone into a full Ikon Base Pass (~$1,019, unlimited for the season). That's what Ben and Megan already hold, but almost nobody else in this group skis enough to justify buying one new — most people are skiing 1–3 days on this one trip. The right product for them is the **Ikon Session Pass** (1, 2, or 3 days — cap the input at 3, this group isn't buying a 4-day — usable across Copper, Winter Park, Steamboat, Eldora, and A-Basin, the exact set this group cares about). The 2-day tier's published starting price is $319; 1- and 3-day are priced at checkout on ikonpass.com and should be treated as estimates until confirmed there.

**[Correction, Phase 4]:** the Ikon Session Pass only ever comes in 2- and 3-day tiers — there is no 1-day tier to buy. A guest skiing a single day isn't buying a smaller Session Pass; they need a standalone resort lift ticket instead (`oneDayLiftTicketByDestination` in `src/data/costAssumptions.ts`). The code has priced this correctly since the Phase 1 research pass; this note is catching the plan doc up to what the code already does, not changing behavior.

Ask for ski days **per person, not per response** — one guest's days and their plus-one's days are frequently different (one person skiing three days while their partner skis one is a completely normal split), so a single shared input would silently misprice half the group. The `ski_days` / `plus_one_ski_days` columns in section 5 exist for exactly this; the guest-facing form should render two small selectors side by side when a plus-one is present ("You" / "Your plus-one"), each with its own 1/2/3/"already have a pass" options, rather than one shared control. Default both selectors to 2 days pre-selected — it's the most common answer for a short trip and saves most people a click; someone skiing 1 or 3 just changes it. Keep the plus-one's copy in third person throughout ("They already have a pass," not "I already have a pass") — it's a small thing, but a first-person label under someone else's name reads as a copy bug the moment anyone actually looks at it.

**Gear ownership is a separate input from ski days, also per person.** Not everyone in the group needs a rental — some people own skis or a board already. Add a second toggle next to each ski-days selector: "bringing my own gear" vs. "need gear (rental)," stored in `gear_status` / `plus_one_gear_status`. When set to "own," the rental line item drops out of that person's cost total entirely rather than showing $0 — a struck-through or grayed line invites more questions ("wait, why is this listed if it's free?") than just omitting the row. This is exactly the kind of per-line conditional the cost table needs to support cleanly: each line item in the breakdown should be able to independently not render, not just show a smaller number.

**On the Base Pass mention:** don't present it as a second option in a side-by-side comparison with the Session Pass — a big, unstyled "$1,019+" sitting next to a $319 card reads as a scary number with no actionable purpose, since almost nobody filling this out is going to buy one. It's only there to answer the implicit "wait, don't Ben and Megan have a different pass?" question. Render it as a small note under the Session Pass card instead — normal body text, no price treated as a headline figure — not as a competing card.

Make sure this is actually persisted, not just held in form state. Every selection here — ski days and gear status for both people, destination preference, availability — should flow through the same autosave path described in section 6, writing to the `respondents` row on change. It's easy to build a calculator that only lives in client-side React state because it feels like a "just for display" widget; don't let that happen here, since Ben's admin rollup (section 3) depends on reading these same values back out of the database, not recomputing them from scratch.

Keep the assumptions **visible and editable in one place** (a `costAssumptions.ts` config), not hardcoded inline, since every number in it is a placeholder until you have real quotes:

```ts
export const costAssumptions = {
  flightRangeByAirport: {
    SFO: [180, 340],
    ORD: [160, 300],
    MKE: [150, 320],
    MSP: [140, 290],
  },
  lodgingPerNightByDestination: {
    steamboat: [70, 130],       // per person, 4-6 to a condo
    summitCounty: [55, 100],
    winterPark: [60, 110],
  },
  ikonSessionPassByDays: {
    // only the 2-day starting price is published up front on ikonpass.com —
    // 1- and 3-day prices are set by a day-selector at checkout. Treat 1/3 as
    // estimates until confirmed there, ideally right before this goes live.
    1: 220,   // estimate — confirm at checkout
    2: 319,   // published starting price
    3: 400,   // estimate — confirm at checkout
  },
  ikonBasePassCurrent: 1019,     // what Ben & Megan already have; only worth buying new above ~5 ski days this season
  rentalPackagePerDayByDays: {
    // per-day rate can drop slightly for multi-day rentals — keep it simple
    // as a flat per-day estimate unless real quotes show otherwise.
    // Only applied when that person's gear_status is 'rental' — skip this
    // line item entirely for 'own', don't render it as $0.
    default: [45, 65],
  },
  foodAndAprèsPerDay: [40, 70],
};
```

The calculator on the guest-facing side takes each guest's stated home airport, destination preference, their own ski days and gear status, and (if applicable) their plus-one's same three inputs, and produces a low/high total per person — pass cost and rental cost both scale off each person's own ski-days input, with the rental line skipped entirely for anyone who marked their own gear. On the admin side, sum it across all respondents (both people per row, where applicable) for a group total. Link out to Google Flights for actual live pricing rather than trying to scrape or hardcode fares — `https://www.google.com/travel/flights?q=Flights%20from%20{ORIGIN}%20to%20{DEST}` is a stable, working deep link pattern that needs no API key.

---

## 9. Content sourcing — keep citations attached to data

Every fact that can go stale (Ikon pricing, blackout dates, flight schedules, hot springs hours) should carry its source right next to it in the data file, not just in this planning doc:

```ts
sources: [
  { label: "Ikon Base Pass, official pricing and blackout dates", url: "https://www.ikonpass.com/en/shop-passes/ikon-base-pass" },
  { label: "Steamboat winter flight schedule", url: "https://www.steamboat.com/plan-your-trip/getting-here-and-around/flights" },
]
```

Render these as small "source" links under the relevant card/section in the UI (this also directly satisfies "revisiting the page later and being able to reference where the info came from"). When Claude Code builds a destination page, it should render each fact block with its source link inline, not batch them into a bottom "references" list that loses the connection.

---

## 10. Route map

```
/                     landing + intake (name, plus-one, home airport, ski level)
/destinations         the three destination cards, full detail
/dates                availability grid (Jan–Mar 2027) + quick picks
/getting-there        flight card personalized to the airport from intake — one card, not three
/costs                cost breakdown, ski-days selector, pass comparison
/me                   "your response" — read/edit, resolved via cookie
/admin                passcode-gated: heatmap, tally, cost rollup
/api/respondents       POST create/update, GET (admin only)
/api/availability      POST bulk-upsert day statuses
/api/declines          POST create/edit, DELETE undo (direction B only)
```

`/getting-there` depends on `home_airport` already being on the respondent's row from intake — if someone lands on this route directly (shared link, revisit) without having completed intake, redirect them back to `/` rather than showing an airport picker here. Keep the personalization logic (which airport's card to render) server-side, resolved from the same cookie-linked respondent row used everywhere else, not from a client-side query param that could be shared or bookmarked with someone else's airport.

For a group this small, a single-page scroll with anchored sections (like the mockups) is honestly fine too and reduces navigation complexity — the route split above is only worth it if the content grows enough that a wizard flow feels better than scrolling. Worth deciding with Claude Code once Phase 1 content is in and you can feel out the length.

**[Update, post-decline] — the routes as built.** The single-page scroll won (section 16, decision 1), so the page routes above collapsed into `/`. What actually exists:

```
/                              everything a guest sees: intake, destinations, dates,
                               getting there, costs, "can't make it" — first-visit or
                               welcome-back, resolved from the identity cookie
/admin                         passcode-gated dashboard (streams under <Suspense>)
src/app/loading.tsx            streamed loading state (shared by / and /admin)
src/app/error.tsx              error boundary in the site's voice

POST   /api/respondents        create the row once intake is complete; replaces a
                               decline-only row in one transaction (section 19, decision 5)
PATCH  /api/respondents        autosave, including destinationRanking; 404 clears the
                               cookie ("session lost")
GET    /api/respondents        the caller's own response, resolved from the cookie
POST   /api/respondents/finish Save & finish — sets submitted_at, 422 lists what's missing
POST   /api/availability       bulk-upsert day statuses
POST   /api/declines           create or edit a decline (200 edit / 201 create)
DELETE /api/declines           undo, direction B only (409 no response, 404 no decline)
POST   /api/admin/login        passcode → signed admin cookie (throttled)
POST   /api/admin/logout
```

Every guest write route calls `guestWriteLimit` first; admin login has its own passcode-attempt throttle.

---

## 11. Build phases

Structure the work as small, independently reviewable phases. Each should be a deployable preview on Vercel before moving to the next — that gives you a checkpoint to actually look at instead of reviewing a huge diff at the end. A phase isn't "done" just because it deploys — see section 14 for the actual gate (tests, types, lint, accessibility) that should pass before moving on.

**[Status, 2026-09-23]:** Phases 0–4 are done and live, plus the decline feature (section 19, PR #6). Phase 4 landed as PRs #4 and #5; its decisions are in section 18. In practice there are no preview deploys: `main` deploys straight to production (see CLAUDE.md), and the checkpoint is the PR plus a green `npm run check`. Where Phase 2 below says "Vercel Postgres", read Supabase Postgres (section 4).

**Phase 0 — scaffold**
Next.js + TypeScript + Tailwind, repo on GitHub, connected to Vercel. Empty landing page deployed. Also stand up the testing harness here, not later: Vitest, Playwright, ESLint, the `npm run check` script, and the GitHub Actions workflow from section 14, all running green on the empty scaffold. Bolting testing on after Phase 2 or 3 is more work than starting with it.

**Phase 1 — static content, no database**
Destination cards, cost breakdown, flight links, Ikon pass info — all from the structured data files in sections 2/8/9. No form submission yet, nothing writes anywhere. This is the bulk of the "does this look and read well" review. Playwright coverage here is mostly visual/accessibility (axe scan, keyboard nav through the static tiles), since there's no data flow yet to test.

**Phase 2 — database + intake**
Add Vercel Postgres, run the schema from section 5, wire up the intake form and the availability grid to real writes, implement the cookie-based identity from section 6, build `/me`. This is where TDD earns its keep — the cost calculator math, the autosave debounce, and the availability aggregation are exactly the kind of logic worth writing a failing test for first.

**Phase 3 — admin view**
`/admin` with passcode gate, availability heatmap, destination tally, cost rollup across respondents. Add the rate-limiting and passcode-attempt throttling from section 14 here, not as a later hardening pass — this is the route with the actual sensitive surface.

**Phase 4 — polish pass**
Mobile layout check, loading/error states on the form, empty states (0 responses yet), and a final pass on copy and visual density now that real content is in. Run the full Playwright mobile-viewport suite here specifically, since this is the pass most likely to surface layout breakage that desktop testing missed.

Give Claude Code one phase at a time with its own acceptance criteria rather than the whole plan at once — it'll produce more reviewable output and you can course-correct on content/design choices before they're baked into later phases.

---

## 12. Environment setup (once, before Phase 2)

```
vercel link
# In the Vercel dashboard: Storage tab → Create → Postgres (Neon)
vercel env pull .env.local
npx drizzle-kit push        # or your migration tool of choice
```

**[Update, Phase 0]:** the Vercel project (`ski-trip-planner`) and its Supabase Postgres integration are already set up — skip the "Storage tab → Create → Postgres" step above and use the Supabase connection string already present in the project's env vars instead.

**[Correction, Phase 2]:** `vercel env pull` doesn't bring the Supabase connection string into `.env.local` *by default*, and the reason is worth knowing. The Vercel↔Supabase integration connects its resource to the **production and preview** environments only, and the env vars it creates there are marked **Sensitive** — Vercel stores those in an unreadable format, so they come back as the literal string `[SENSITIVE]` from the CLI, the API, and the dashboard alike. `vercel env pull` defaults to the *development* environment, where those keys simply don't exist, which is why a bare pull returns almost nothing.

**The fix**: add `development` to the variables' target list. Vercel forbids sensitive variables in the development environment ("If the Development environment is selected, you will be unable to enable the switch"), so a development-targeted value is readable, and `vercel env pull` returns it in plaintext from then on:

```bash
# One-off, per variable. Get each id from the project env listing.
vercel api /v9/projects/<project-id>/env            # find the id for POSTGRES_URL
echo '{"target":["production","preview","development"]}' > patch.json
vercel api -X PATCH /v9/projects/<project-id>/env/<env-id> --input patch.json
vercel env pull .env.local --environment=development
```

Done for `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING` on this project. `vercel integration resource connect <resource> <project> --environment development` is the tidier route for a fresh setup, but it refuses when the project is already connected and wants a disconnect first, which would pull the variables out of production in the meantime.

Local and CI test runs still don't need any of this: they set `DATABASE_URL` against a throwaway Docker Postgres, which `src/db/client.ts` prefers when present (section 16, decision 5).

Add `ADMIN_PASSCODE` as an env var in Vercel (production + preview) before Phase 3. *[Superseded: `ADMIN_PASSCODE` and `ADMIN_COOKIE_SECRET` both live in Vercel **Production** and `.env.local` only, not preview or development. `vercel env pull` overwrites `.env.local` and drops them, so re-add both afterwards. See CLAUDE.md, "Environment variables".]*

### Applying schema changes

`src/db/schema.ts` is the source of truth, and `drizzle/NNNN_*.sql` must replay cleanly into a matching database. When you change `schema.ts`, run `drizzle-kit generate` and commit the new file along with its `meta/` snapshot and journal entry. Pushing to production without generating a file is how `rate_limits` ended up with no `CREATE TABLE` until `0002_rate_limits.sql` (written `IF NOT EXISTS`, since production already had the table).

**Production (Supabase).** `main` deploys straight to production, so **apply the schema change before merging the code that reads it.** Otherwise the deploy goes out against a missing table. Keep changes additive (new tables or nullable columns) so the old code keeps running on the new schema. Either route works:

```bash
# Push from schema.ts over the direct (non-pooled) connection
vercel env pull .env.local --environment=development   # then re-add the two admin secrets
node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push
```

…or paste the new `drizzle/NNNN_*.sql` into Supabase's SQL editor.

**Row-level security.** Supabase's Data API is **on** for this project, and it serves every `public` table over REST to the anon key, which is public by design. RLS is the only gate. Every table therefore declares `.enableRLS()` in `schema.ts`, with no policies. The app connects as `postgres`, which owns the tables and has `BYPASSRLS`, so it is unaffected. A new table needs `.enableRLS()` as well; `e2e/schema.spec.ts` fails without it. RLS was off on every table until 2026-09-23, when `0003_enable_rls.sql` was applied to production. A rolled-back probe confirmed that `postgres` still reads the tables and `anon` sees nothing.

**Tests.** `e2e/global-setup.ts` starts a throwaway `postgres:16` container (`ski-trip-e2e-pg`, port 54329), unless `DATABASE_URL` points elsewhere. It builds the schema by replaying `drizzle/*.sql` through drizzle's migrator, not by pushing `schema.ts`, so a missing or wrong migration file fails the suite the same way it would break a fresh database.

---

## 13. Facts worth re-verifying before this goes live

Everything below was accurate as of late August 2026 but is exactly the kind of thing that should be double-checked (and re-sourced per section 9) closer to when the group is actually deciding, since it will have moved:

- Ikon Base Pass price (currently $1,019, climbs toward a December cutoff)
- Ikon Session Pass pricing — 2-day is published at $319; the 1-day and 3-day figures in `costAssumptions.ts` are estimates and need to be confirmed against the day-selector at checkout on ikonpass.com
- Steamboat 26/27 blackout dates (currently Dec 26–30, Jan 16–17, Feb 13–14 — same window applies to both Base and Session passes)
- HDN winter flight roster (currently 18 airports including SFO, ORD and MSP but *not* MKE, season runs Dec 10, 2026 – April 2027)
- Any hardcoded lodging/rental price ranges in `costAssumptions.ts` — these are placeholders, not quotes
- Named restaurant/brewery/activity recommendations per destination — the current data files only have placeholder genre descriptions ("a brewery scene"); these need an actual research pass before they're useful to the group
- Drive-time estimates from DEN (Steamboat ≈3h15, Summit County ≈1h45, Winter Park ≈1h20) are reasonable static figures for normal conditions but don't account for I-70 weekend ski traffic or storm closures — worth a caveat in the UI rather than presenting them as guaranteed

---

## 14. Testing, QA, and the quality bar

This is a trip-planning tool for a dozen friends, not a production SaaS product — but worth building with real engineering discipline anyway, partly because it's good practice and partly because it's what makes it safe to let Claude Code run with less supervision (see section 15). A codebase with a real test suite is one an autonomous agent can be trusted to self-check; one without is a codebase you have to review line by line.

- **Test-driven, per unit of logic — not dogmatically upfront.** For anything that computes or transforms data (the cost calculator, availability aggregation, the cookie/session resolution, the Zod schemas), write the test first, watch it fail for the right reason, implement until it passes, then refactor. Static content — the destination tiles, the hero — needs visual review instead, not a unit test wrapped around prose.
- **Unit/integration tests: Vitest.** Native TypeScript, no extra config layer, fast enough to run on every save. Cover the cost math from section 8, the blackout/window date logic from section 7, and every Zod schema's edge cases (missing plus-one fields, an out-of-range ski-days value, etc.).
- **End-to-end tests: Playwright.** This is what actually verifies the app works the way a guest experiences it, and it's the thing that makes an unattended agent run trustworthy — Claude Code can run `npx playwright test` itself after every phase and treat red as a stop signal instead of declaring victory. Minimum coverage:
  - The full flow: intake → destinations → dates → cost → save & finish, with the respondent row checked in the database afterward, not just the UI.
  - Returning-visitor flow: revisit with the same cookie, confirm the form pre-fills instead of starting blank.
  - `/admin`: passcode gate blocks unauthenticated access; heatmap and tally render once authenticated.
  - A mobile-viewport pass (Playwright's device emulation) over the same flows — this is how most guests will actually fill it out.
- **Type-checking and linting are gates, not suggestions.** `tsc --noEmit` and ESLint both need to pass clean before a phase counts as done. Wire both into an `npm run check` script and into CI (below) so nothing ships broken silently.
- **Accessibility.** Run `@axe-core/playwright` against every page as part of the E2E suite. Specifically verify contrast on the gold accent against both the pine header and the snow background — the one pairing in this palette worth checking by tool and by eye. The calendar grid and the ski-days/gear toggles are currently styled `<div>`/`<label>` elements in the mockup, not native interactive controls — when these become real components, confirm they're keyboard-operable with visible focus states and correct `role`/`aria-pressed`, not just clickable.
- **CI on every push.** A GitHub Actions workflow running lint + typecheck, Vitest, and Playwright (against a Vercel preview URL) on every PR, blocking merge on failure. *[As built: `.github/workflows/ci.yml` runs on Node 22. Playwright tests a local `next build && next start` (the `playwright.config.ts` webServer) against a throwaway Docker Postgres, not a preview URL.]*
- **Security, sized to what this app actually holds.** Every API route validates input with the section 4 Zod schemas — never trust payload shape, even from a friend group. Rate-limit the public write endpoints and the admin passcode attempts (a simple in-memory or Vercel KV token bucket is enough at this scale). *[As built: a fixed-window counter in the Postgres `rate_limits` table, `hitRateLimit` in `src/db/queries.ts`, so limits hold across serverless instances.]* Render user-supplied text (the `notes` field, etc.) as text, never raw HTML, to close off stored-XSS by construction. `ADMIN_PASSCODE` stays in Vercel env vars, never committed.
- **Error and empty states count as part of "done."** What a guest sees if autosave fails mid-session (retry quietly, then surface a small indicator if it keeps failing), and what the admin view shows with zero responses — both belong in each phase's acceptance criteria, not a later polish pass.

Calibrate this deliberately: the bar is "a stranger reading this codebase wouldn't wince," not "ready for a Fortune 500 launch." Skip load testing, multi-region failover, and SOC2-grade audit logging — none of that is proportionate to a dozen friends filling out a form.

---

## 15. Working with Claude Code — a few notes

- Put this file and the mockup HTML in the repo root (or a `/docs` folder) and point Claude Code at both directly in your first prompt, rather than re-explaining the project verbally — it can re-read either as needed.
- Add a short project `CLAUDE.md` alongside them with house style (package manager, commit message conventions, whether you want PRs or direct commits to `main`) and a one-line pointer to this plan — Claude Code loads `CLAUDE.md` automatically at the start of every session, so anything that should be true in *every* session belongs there rather than repeated in prompts.
- **Use plan mode for the first pass of each phase.** Plan mode has Claude Code analyze and propose an approach before touching any files, and you approve or redirect before it writes code — worth doing at the start of every phase in section 11, even once you're comfortable letting it run unattended within a phase.
- **For autonomous execution within an approved phase, use auto mode**, Claude Code's permission mode that lets it act on a classifier's judgment of what's safe rather than prompting for every file edit and command. Run `/auto-mode-setup` once early on to define what counts as trusted here (installing npm packages, running the dev server, running tests, git commits) versus what should still pause for you. This is the mode that actually gets you "set it and let it work" rather than approving every single tool call — the quality gates in section 14 are what make that safe rather than reckless.
- **Pair auto mode with `/goal`** for each phase: set an explicit, checkable condition — e.g. "Phase 2 is done when `npm run check` passes, all Vitest and Playwright tests are green, and the intake form successfully writes a row to Postgres" — and Claude Code will keep working against that condition without needing you to re-prompt it after every step. Keep a human checkpoint at the *phase boundary* even so: review the Vercel preview and the test report before greenlighting the next phase, rather than chaining all five phases into one unattended run.
- Consider a `PostToolUse` hook that runs lint and the relevant test file automatically after each edit — catches regressions immediately instead of at the end of a long unattended stretch, and keeps auto mode from drifting for several files before anything checks its own work.
- Point Claude Code at the destination/cost/source data structures in sections 2, 8, and 9 early — get the data model right before UI polish, since UI built against a wrong-shaped data model gets rebuilt, not patched.

---

## 16. Phase 2 implementation decisions (confirmed before implementation started)

Phase 0 and Phase 1 are complete and live (see the commit history and CLAUDE.md). Before writing any Phase 2 code, a Fable subagent produced a detailed implementation plan (data model translation, cookie/autosave mechanics, API routes, availability grid logic, TDD scope, CI database strategy) and the following decisions were made explicitly, resolving places where PLAN.md, the mockup, and Phase 1's reality disagreed:

1. **No `/me` route.** `/` itself reads the identity cookie server-side and renders either the first-visit or "welcome back" state — matching Phase 1's single-page-scroll decision rather than introducing a second route. No redirect stub needed either.
2. **Blackout dates are fully non-interactive on the availability grid**, not just visually flagged — they can't be set to available/maybe/unavailable at all. *[Reversed during Phase 3: availability and destination preference are separate questions, and coupling them was actively harmful. Marking a day available and then choosing Steamboat left that day disabled with its row still in the database — the guest couldn't clear it and it kept feeding the admin heatmap. Blackout days are now flagged identically for everyone, regardless of destination, and stay fully selectable; the flag is carried in the accessible name rather than by disabling the control.]* Correct the mockup's "Ikon blackout (Steamboat only)" legend copy: per Phase 1's `passInfo.ts`, the Session Pass blackout (Jan 16–17 and Feb 13–14, 2027) actually hits **both Steamboat and Winter Park**; Copper Mountain is unaffected on every Ikon tier.
3. **Destination preference is one select control**, not a separate toggle — it feeds `destination_votes` (rank 1) and the cost section just displays the chosen destination's name as text, driving which numbers show. Full multi-destination ranking is deferred past Phase 2. *[Superseded during Phase 3: destinations are now **ranked**, not picked. The cards sit in an ordered list that can be dragged, or reordered with up/down buttons on each card — the buttons are the accessible path, not a fallback, since native HTML5 drag-and-drop is unusable by keyboard and screen reader and would have failed section 14's gate outright. All ranks are written to `destination_votes` (1..n), the cost estimate follows rank 1, and the admin tally shows the full placement spread and average rank rather than only first choices — which is the point of ranking: a destination nobody puts first but everyone puts second is a real answer. The ranking starts **unset** rather than pre-filled with the declared order, so an untouched form is distinguishable from a considered ranking; an explicit "This order works for me" button exists for anyone who agrees with the default, who would otherwise have no way to say so.]*
4. **`home_airport` is a fixed list, with no `'OTHER'`** — drop the `'OTHER'` option from section 5's SQL comment; it's unused everywhere else (mockup, Phase 1 destination/airport data, cost calculator). *[Amended after Phase 2 merged: the list is `'SFO' | 'ORD' | 'MKE' | 'MSP'`. MSP was missed in the original planning pass. No migration was needed — `home_airport` is a `text` column whose allowed values live in the TypeScript union and the Zod enum, not in a Postgres enum or check constraint, so widening it is a code change only. Unlike MKE, MSP **is** on the HDN nonstop roster (Delta), so it gets the direct-to-Steamboat note in the flight card.]*
5. **E2E tests get a real Postgres via a Docker/Postgres service container in CI**, not a second Supabase project — keeps production Supabase completely untouched by test runs. `DATABASE_URL` (when set) overrides the Supabase connection in the app's DB client, which is how local/CI test runs point elsewhere. *[As built: there's no CI `services:` block. Playwright's `globalSetup` starts its own `postgres:16` container and replays the migrations into it, so local and CI runs take the same path; see section 12, "Applying schema changes".]*
6. **Pass-holders and the rental line**: when `already_has_pass` is true, `ski_days` is null (per the existing schema), so the rental line (only shown if `gear_status` is 'rental') assumes **2 ski days** for scaling purposes. This is a stated assumption, captioned visibly in the cost breakdown rather than silently baked in.
7. **The respondent row (and autosave) isn't created on the first keystroke.** Intake has to be fully complete — name, plus-one choice, home airport, ski level, and email all filled in — before the first `POST` creates the row and autosave takes over. Trade-off, accepted explicitly: someone who fills in only part of intake and closes the tab loses that partial state, since nothing persisted yet. Acceptable given intake is a ~20-second, 5-field step.
8. **New `email` field, not in the original section 5 schema.** Added so the host can reach respondents later. Required to complete "Save & finish" (not optional) — shown in the intake step alongside name/plus-one/airport/ski-level.

These decisions supersede the corresponding details in sections 5–8 and 10 above where they conflict; the rest of those sections still apply as written.

---

## 17. Phase 3 implementation decisions (confirmed before implementation started)

Phase 2 is complete, merged to `main`, and live. Before writing Phase 3 code, a
Fable planning agent produced a detailed implementation plan (passcode gate,
aggregation modules, rate limiting, accessibility, build order) and the
following decisions were made explicitly. As with section 16, treat these as
settled.

1. **Build the passcode gate; don't use Vercel Deployment Protection.** Section 6
   offers both. Vercel's built-in protection would need no auth code, but it
   would also block the Playwright suite exactly the way it blocks any
   unauthenticated client — the preview deploy couldn't be tested end to end
   during Phase 2 for precisely this reason. A passcode keeps `/admin` a normal,
   testable part of the app on every environment.

2. **`maybe` counts toward heatmap density at a quarter weight.**
   `score = available + 0.25 × maybe`, and the density tier is computed from
   that score. Both raw numbers stay visible in the cell. A "maybe" is real
   signal but much weaker than a yes, and blending them equally would make a day
   everyone is unsure about look like a day everyone is free.

3. **Only completed responses are reported.** Every admin figure — count,
   heatmap, tally, cost rollup — is filtered to `submitted_at IS NOT NULL`.
   In-progress respondents are not surfaced at all, not even as a secondary
   count. Section 6 gives `submitted_at` exactly this job.

4. **No per-day "who's available" drill-down.** Sections 3 and 7 describe a
   density view. A drill-down adds expand/collapse controls and focus management
   for information nobody asked for; revisit in a later phase if the heatmap
   alone proves too coarse.

5. **The admin cookie is signed with its own random secret**
   (`ADMIN_COOKIE_SECRET`, 32 random bytes), not with `ADMIN_PASSCODE`. Reusing
   the passcode as the HMAC key would let anyone holding one observed cookie
   brute-force a human-chosen passcode *offline*, at full speed, with the login
   rate limit never involved. The data at stake is low value and the attack is
   largely theoretical — this is accepted on the grounds that it costs one
   machine-generated env var, not because the threat is pressing.

6. **`rate_limits` rows are pruned after 12 hours**, deleted opportunistically
   inside the limiter rather than by a cron job or separate process. Each new
   (bucket, window) pair inserts a row that is never read again; without pruning
   the table grows without bound. Slow at this scale, but still a leak.

7. **Admin session lasts 12 hours**, and **`/admin` has a logout control** —
   this will get opened on a phone.

8. **Rate limits: 5 login attempts per 5 minutes per IP; 300 writes per minute
   per IP** on the guest endpoints. Calibrated against section 14's "a dozen
   friends" bar. *[Corrected during implementation: the guest figure was
   originally 60/min, which a test caught as too low to ship. The 700ms
   autosave debounce alone permits ~86 writes/minute, and section 6 asks the
   calendar grid to save on change rather than on a debounce, so drag-painting
   emits roughly one request per network round trip. 60/min would have
   rate-limited guests out of their own form. The limit is a backstop against
   scripted abuse, not a quota on real use, so it should sit well clear of the
   legitimate ceiling.]*

9. **`ADMIN_PASSCODE` is set by Ben directly** — `vercel env add ADMIN_PASSCODE
   production` plus a line in `.env.local` — so the real value never passes
   through an agent transcript. For local runs it lives in `.env.local` only,
   never in the Vercel `development` environment; the same goes for
   `ADMIN_COOKIE_SECRET` (see CLAUDE.md). The e2e suite uses its own committed
   throwaway passcode and never touches the real one.

10. **`mockup.html` stays frozen** at its pre-build state (three airports, no
    admin view). It is a design reference from before implementation, not a
    living artifact.

These decisions supersede the corresponding details in sections 3, 6, 7, 8 and
14 above where they conflict; the rest of those sections still apply as written.

---

## 18. Phase 4 implementation decisions (confirmed before implementation started)

Phase 3 is complete, merged to `main`, and live. Phase 4 as originally written
in section 11 was partly delivered incidentally during earlier phases — the
mobile Playwright test suite was already in place, a sideways-scroll regression
test came in Phase 3, admin empty/error states were built then, and the save-bar's
error state was already in place before Phase 4 began. Rather than a from-scratch
polish sweep, Phase 4 became a targeted set of bug fixes and gaps. The decisions
below were made explicitly:

1. **The `notes` field and admin roster view are deferred.** The backend is
   fully plumbed — schema, validation, and PATCH route all exist — but
   surfacing `notes` in the UI and building a roster view were deliberately cut
   from this phase to keep scope bounded. Both are ready to pick up in a later
   phase without rework; the infrastructure is there.

2. **Autosave error state gets accurate messaging.** Section 6 describes error
   handling for autosave failures. Rather than surfacing a false "we'll keep
   trying" claim when save fails, the error indicator now shows a fixed,
   accurate string ("Couldn't save your last change"). No retry button was
   added — considered but rejected in favor of keeping the change minimal and
   letting the guest refresh or reach out manually if needed.

3. **The home page degrades gracefully when the database is unreachable.** When
   Postgres is down, `/` renders its full reference content — destinations,
   costs, flights — with an inline notice that saved answers couldn't load,
   matching the pattern `/admin` already follows. A guest with a dead
   identity-cookie lookup can still read and explore the trip; they just can't
   save responses until service recovers.

4. **The availability grid's tablet tap-target problem is fixed via layout
   breakpoint.** Moving the 3-column grid breakpoint from `sm:` (640px) to
   `lg:` (1024px) gives enough width on tablets for larger targets and cleaner
   spacing. The fix was verified with visual and screenshot review rather than
   adding a new dedicated Playwright device project, which would have added
   meaningfully to e2e runtime for a problem already covered by existing mobile
   tests. *[Corrected during implementation: the breakpoint was first moved to
   `md:` (768px), but Tailwind's `md:` is min-width-inclusive of exactly
   768px — the same threshold as the old `sm:` — so it had no effect at the
   primary tablet-portrait width the fix targeted. `lg:` (1024px), combined
   with the app's `max-w-[980px]` container, correctly keeps the grid
   single-column through the full tablet-portrait range.]*

5. **The name/email autosave debounce bug is fixed using the existing path.**
   Keystroke-by-keystroke saves were being sent instead of using the debounce
   already written and already tested in the codebase. Plugging the intake form
   into that path required no new logic, only wiring the existing mechanism
   where it was missing.

6. **OpenGraph metadata is added for link previews.** When the app is shared in
   a group chat, the preview now carries a clean title and description (no
   image, consistent with the site's no-stock-photo visual stance). This is
   pure content work, no dynamic per-route logic.

7. **The `Section` component's fixed left gutter is collapsed on phone widths.**
   The gutter was sized to hold the step-number badge; below the `sm:` (640px)
   breakpoint, the badge moves inline above the heading instead, reclaiming
   width on narrow screens.

8. **Hero's decorative sun circle no longer renders as a stretched oval.** The
   header's background SVG uses `preserveAspectRatio="none"` so its mountain
   silhouettes fill the header at any aspect ratio; that same setting also
   stretched the circle drawn inside it whenever the header's actual aspect
   ratio didn't match the viewBox's 1000:300, which is most of the time.
   Found during the mobile visual-review pass, not planned in advance; fixed
   by moving the circle outside the SVG into a plain positioned `div`.

**Note on scope:** the mobile-viewport Playwright suite already existed as a
full test project before Phase 4 (running the entire suite at Pixel 7 width).
Phase 4 added a dedicated `e2e/mobile.spec.ts` with touch-specific assertions
(tap-to-cycle, sideways-scroll across more app states, minimum tap-target
sizes) rather than standing up mobile coverage from scratch.

These decisions supersede the corresponding details in sections 6, 8, and 14
above where they conflict; the rest of those sections still apply as written.

---

## 19. Decline / can't-attend decisions (confirmed before implementation started)

Phase 4 is complete, merged to `main`, and live. Before writing the decline
feature, the following decisions were made explicitly, resolving how "I can't
make it" fits into a schema and an admin view that were both built assuming
every response was a yes:

1. **Separate `declines` table, not a flag on `respondents`.** `respondents`
   doesn't accept a partial row — `name`, `email`, `home_airport`, and
   `ski_level` are all `NOT NULL` (section 16, decision 7: nothing is written
   until intake is fully complete), so there's no half-filled respondent shape
   a decline could reuse. A decline also has nothing to put in those
   columns — no airport, no ski level to give — so a flag on `respondents`
   would mean either relaxing those `NOT NULL`s for everyone or leaving them
   meaninglessly filled. A standalone table, with its own nullable columns for
   what a decline actually has (name, email, reason), fits what's really there.

2. **Same cookie token can live in both tables at once — no relationship
   between them.** `declines.cookie_token` carries its own `UNIQUE` constraint
   and no `references()` call to `respondents`, the same pattern `rate_limits`
   already uses for a caller with no respondent row at all. A guest who's
   already submitted keeps their `respondents` row untouched if they decline
   afterward — the two rows about the same browser coexist, and nothing in the
   schema stops that.

3. **Precedence rule: a decline overrides every admin aggregate; the two raw
   counts stay disjoint by construction.** `countedForAdmin()` in
   `src/db/queries.ts` is `submitted_at IS NOT NULL AND NOT EXISTS (SELECT 1
   FROM declines WHERE declines.cookie_token = respondents.cookie_token)` —
   every admin query (`countSubmittedRespondents`, `availabilityCountsByDate`,
   `listSubmittedDestinationRankings`, `listSubmittedRespondentsWithTopChoice`)
   filters through it, so a respondent who's since declined drops out of all
   of them, even though their row is untouched. `countDeclines()` counts every
   row in `declines`, unfiltered, and that's correct precisely because
   `countedForAdmin()` already pulled anyone with a decline out of the
   respondent-side counts first — the two numbers never double-count the same
   browser.

4. **Two entry points, one component, and the server picks the schema
   itself.** `CantMakeIt` (`src/components/CantMakeIt.tsx`) renders one of two
   forms depending on whether the guest already has a response, but the
   server doesn't trust that render choice — `POST /api/declines`
   (`src/app/api/declines/route.ts`) calls `currentRespondent()` itself and
   picks `declineReasonSchema` (a respondent row exists, only a reason is
   asked) or `declineSchema` (no respondent row, name/email/reason are all
   asked). For the first case, name and email on the new decline row are
   copied server-side from the existing respondent row rather than taken from
   the request — `declineReasonSchema` doesn't even accept those fields.

5. **Undo is asymmetric because the two directions start from different
   states.** Direction A — declined first, no respondent row —
   `replaceDeclineWithRespondent()` deletes the decline and inserts a fresh
   respondent row with a new cookie token in one transaction, invoked from the
   regular intake path rather than a dedicated undo endpoint: completing
   intake *is* the undo. Direction B — a respondent row already existed, then
   declined — is undone via `DELETE /api/declines`, which requires
   `currentRespondent()` to resolve and returns 409 ("There's no way to undo
   this without an existing response — start one instead.") when it can't,
   or 404 ("No "can't make it" on file for this browser.") when there's no
   decline to remove. The client treats that 404 as success. That combination — a
   call to this endpoint with no respondent row on file — shouldn't occur
   given the UI only ever calls `DELETE` from within an existing response; the
   409 guards it anyway rather than silently doing nothing.

6. **No admin list of names, reasons, or emails — ever.** `src/app/admin/page.tsx`
   calls `countDeclines()` and renders only the number; nothing in the app
   reads `name`, `email`, or `reason` back out of `declines` anywhere else.
   Anything more granular than the count is a direct database query Ben runs
   himself.

7. **`reason` is capped at 200 characters; the decline email is free text.**
   `DECLINE_REASON_MAX = 200` in `src/lib/schemas.ts` bounds `reason` on both
   `declineSchema` and `declineReasonSchema`. Email on the decline form is
   `z.string().trim().max(254).optional()` — length-capped, no format check — unlike `emailSchema`
   (`z.email(...).max(254)`) used throughout intake: it's optional, Ben reads
   it himself, and rejecting a plausible-looking typo helps nobody here.

8. **Shipped without gating on the production migration.** `drizzle/0001_declines.sql`'s
   `CREATE TABLE declines` needs to be pasted into Supabase's SQL editor after
   this branch merges — the same manual step `drizzle/0000_phase2_initial.sql`
   needed in Phase 2 (section 12), and for the same reason: the production
   Postgres connection string is a Vercel Sensitive variable, unreadable by
   any migration tool run from outside Vercel's own infrastructure.
   *[Correction, post-merge review: both halves of this were wrong.
   (a) The connection string is readable: the section 12 correction put
   `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` on the development target, and
   `drizzle-kit push` works through that route. (b) "After this branch
   merges" is the wrong order. Every page load and every intake POST now
   queries `declines`, and merging deploys straight to production, so the
   table must exist first or `/`, intake, and `/admin` all fail. The
   migration is purely additive and safe to run early. The procedure now
   lives in section 12, "Applying schema changes". Checked against production
   on 2026-09-23: `declines` exists and matches `schema.ts`. That check also
   found RLS off on all five tables, with the `anon` role able to `SELECT`
   from each; fixed the same day (section 12, "Row-level security").]*

9. **Known limit of cookie identity (recorded after review).** A guest who
   declines in one browser and later responds from another device leaves an
   orphaned decline row. They show up in both the decline count and the
   respondent counts, and nothing links the two tokens. At this group size,
   Ben reconciles it by hand in the database, as section 6 already expects
   for device switches.

These decisions supersede the corresponding details in sections 5 and 10
above where they conflict; the rest of those sections still apply as written.
