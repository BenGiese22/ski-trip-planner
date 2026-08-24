import type { Source } from "./types";

// Ikon facts that aren't prices — see costAssumptions.ts for pricing.
export const passInfo = {
  sessionPassResorts: [
    "Steamboat",
    "Copper Mountain",
    "Winter Park",
    "Eldora",
    "Arapahoe Basin (A-Basin)",
  ],
  // The full/Base Ikon Pass has no blackout dates anywhere. The Session
  // Pass — what most of this group will actually buy — blacks out on these
  // dates at Steamboat AND Winter Park. Copper has no blackout dates on any
  // Ikon tier, making it the only destination that's blackout-free for
  // Session Pass holders.
  sessionPassBlackoutDates: {
    steamboat: [
      "2026-12-26",
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2027-01-16",
      "2027-01-17",
      "2027-02-13",
      "2027-02-14",
    ],
    winterPark: [
      "2026-12-26",
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2027-01-16",
      "2027-01-17",
      "2027-02-13",
      "2027-02-14",
    ],
    summitCounty: [],
  },
  // Resorts where Ikon Pass holders must reserve a lift ticket day in
  // advance. As of the 2026-27 season this is Jackson Hole, Deer Valley,
  // The Summit at Snoqualmie, and Loon Mountain — none of our three.
  reservationsRequired: false,
} as const;

export const passSources: Source[] = [
  {
    label: "Ikon Pass FAQ",
    url: "https://www.ikonpass.com/en/faq",
  },
  {
    label: "Ikon Pass Buyer's Guide 2026-27",
    url: "https://www.onthesnow.com/news/ikon-pass-buyers-guide/",
  },
  {
    label: "Ikon Pass list of resorts 2026-27 (reservation requirements)",
    url: "https://snowbrains.com/ikon-pass-list-of-resorts-2026-27/",
  },
  {
    label: "Winter Park Resort — Ikon Session Pass",
    url: "https://www.ikonpass.com/en/local-passes/winter-park-resort/season-pass",
  },
];
