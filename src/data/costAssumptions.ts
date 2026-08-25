import type { Source } from "./types";

// Every number here is a planning estimate, not a live quote. See `sources`
// below for what's been confirmed vs. still placeholder as of Aug 2026.
export const costAssumptions = {
  flightRangeByAirport: {
    SFO: [180, 340],
    ORD: [160, 300],
    MKE: [150, 320],
  },
  lodgingPerNightByDestination: {
    steamboat: [70, 130], // per person, 4-6 to a condo
    summitCounty: [55, 100],
    winterPark: [60, 110],
  },
  // Ikon Session Pass comes in 2- and 3-day tiers only — there is no 1-day
  // option. Confirmed pricing (not an estimate): 2-day $319 (student $249),
  // 3-day $429 (student $359). Covers Copper, Winter Park, Steamboat,
  // Eldora, and A-Basin.
  ikonSessionPassByDays: {
    2: { standard: 319, student: 249 },
    3: { standard: 429, student: 359 },
  },
  // Someone skiing exactly 1 day buys a standalone resort lift ticket
  // instead of a Session Pass. Resorts use dynamic, date-based pricing and
  // 2026-27 figures aren't published yet (typically released Sept-Nov) —
  // these ranges are 2025-26 season actuals (walk-up window price) kept as
  // a placeholder; advance online purchase runs well below the low end.
  oneDayLiftTicketByDestination: {
    steamboat: [180, 360],
    summitCounty: [110, 260],
    winterPark: [130, 270],
  },
  // What Ben & Megan already hold; only worth buying new above ~5 ski days
  // this season.
  ikonBasePassCurrent: 1019,
  rentalPackagePerDayByDays: {
    // Only applied when that person's gear_status is 'rental' — the line
    // item is skipped entirely for 'own', not rendered as $0.
    default: [45, 65],
  },
  foodAndApresPerDay: [40, 70],
  // Nothing about the trip length is settled yet — the availability grid asks
  // when people are free, not how long the trip runs. These figures are the
  // shape of the weekend the quick-picks describe, and the cost breakdown
  // captions them as an assumption rather than presenting them as decided.
  tripLength: {
    nights: 4,
    foodDays: 4,
  },
} as const;

export const costSources: Source[] = [
  {
    label: "Ikon Session Pass, resort coverage",
    url: "https://www.onthesnow.com/news/ikon-pass-buyers-guide/",
  },
  {
    label: "Ikon Base Pass, official pricing and blackout dates",
    url: "https://www.ikonpass.com/en/shop-passes/ikon-base-pass",
  },
  {
    label: "Steamboat Resort lift ticket price hits record high",
    url: "https://www.steamboatpilot.com/news/steamboat-resort-lift-ticket-price-hits-record-high-officials-say-its-to-keep-patrons-safe/",
  },
  {
    label: "Copper Mountain — winter lift tickets",
    url: "https://www.coppercolorado.com/tickets-passes/lift-tickets/tickets/",
  },
  {
    label: "Winter Park Resort — lift tickets & ski pass",
    url: "https://www.winterparkresort.com/plan-your-trip/lift-tickets-ski-pass",
  },
];
