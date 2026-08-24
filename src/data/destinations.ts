import type { Destination } from "./types";

export const destinations: Destination[] = [
  {
    slug: "steamboat",
    name: "Steamboat Springs",
    mountain: "Steamboat",
    passAccess: "5-day, blackout dates",
    driveTimeFromDenver: "≈3h15",
    directFlightAirport: "HDN",
    badge: { label: "Leaning toward this", tone: "gold" },
    costRangePerPerson: [900, 1300],
    tiles: [
      {
        tileLabel: "On the mountain",
        bullets: [
          "Champagne powder, with gentle green terrain low on the hill",
          "More pitch up top if a few of you want it",
          "No Ikon lift reservations required this season",
        ],
      },
      {
        tileLabel: "Getting around",
        bullets: [
          "Free in-town bus (the SST) links downtown to the gondola",
          "A car is optional if you're staying central",
        ],
      },
      {
        tileLabel: "Food, drink & town",
        bullets: [
          "Barley Tap & Bar — 31 rotating taps, downtown on Lincoln Ave",
          "Mountain Tap Brewery — wood-fired food, family-friendly patio",
          "Aurum Food & Wine — upscale New American, riverfront patio",
        ],
      },
      {
        tileLabel: "Off the snow",
        bullets: [
          "Old Town Hot Springs — developed, family-friendly, downtown",
          "Strawberry Park Hot Springs — rustic natural pools outside town (4WD/snow tires required in winter)",
          "Shops along Lincoln Ave downtown",
        ],
      },
    ],
    sources: [
      {
        label: "Steamboat winter flight schedule (18-airport roster)",
        url: "https://www.steamboatchamber.com/plan-your-trip/getting-here/flying/winter-schedule/",
      },
      {
        label: "Ikon Base Pass, official pricing and blackout dates",
        url: "https://www.ikonpass.com/en/shop-passes/ikon-base-pass",
      },
      { label: "Barley Tap & Bar", url: "https://www.thebarleycolorado.com/" },
      { label: "Mountain Tap Brewery", url: "https://www.mountaintapbrewery.com/" },
      { label: "Aurum Food & Wine", url: "https://aurumsteamboat.com/" },
      { label: "Old Town Hot Springs", url: "https://oldtownhotsprings.org/" },
      { label: "Strawberry Park Hot Springs", url: "https://strawberryhotsprings.com/" },
    ],
  },
  {
    slug: "summitCounty",
    name: "Summit County — Frisco, Dillon, Silverthorne",
    mountain: "Copper Mountain",
    passAccess: "unlimited",
    driveTimeFromDenver: "≈1h45",
    directFlightAirport: null,
    badge: { label: "Best value", tone: "pine" },
    costRangePerPerson: [650, 950],
    tiles: [
      {
        tileLabel: "On the mountain",
        bullets: [
          "Terrain zoned left to right by ability",
          "Mixed group regroups easily at the same base area",
          "Unlimited on every Ikon tier, no blackout dates — the only destination that's blackout-free for Session Pass holders",
        ],
      },
      {
        tileLabel: "Getting around",
        bullets: [
          "Three towns spread along I-70",
          "Free Summit Stage bus connects them and Copper Mountain, or bring a car",
        ],
      },
      {
        tileLabel: "Food, drink & town",
        bullets: [
          "Prost (Ein Prosit) — German beer hall, rare imports, giant pretzels",
          "Tavern West — upscale-casual New American, rotating craft beers",
          "Kemosabe at Silverheels — Colorado-Asian fusion in an old log cabin",
        ],
      },
      {
        tileLabel: "Off the snow",
        bullets: [
          "Outlets at Silverthorne for shopping",
          "Free community ice rink and a groomed winter trail at Dillon Reservoir",
          "Cheapest condo/Airbnb inventory of the three towns",
        ],
      },
    ],
    sources: [
      {
        label: "Copper Mountain, Ikon Pass access",
        url: "https://www.coppercolorado.com/tickets-passes/season-passes/ikon-pass/",
      },
      { label: "Summit Stage — free bus service", url: "https://www.summitcountyco.gov/services/transit_summit_stage/bus_schedule/index.php" },
      { label: "Prost (Ein Prosit)", url: "https://www.yelp.com/biz/prosit-fine-beers-and-sausages-frisco-2" },
      { label: "Tavern West", url: "https://www.yelp.com/biz/tavern-west-frisco" },
      { label: "Kemosabe at Silverheels", url: "https://www.yelp.com/biz/kemosabe-at-silverheels-frisco" },
      { label: "Outlets at Silverthorne", url: "https://www.outletsatsilverthorne.com/" },
      { label: "Dillon winter activities", url: "https://www.townofdillon.com/parks-rec/winter-activities/community-ice-rink" },
    ],
  },
  {
    slug: "winterPark",
    name: "Winter Park",
    mountain: "Winter Park",
    passAccess: "unlimited",
    driveTimeFromDenver: "≈1h30",
    driveNote: "No I-70 — via US-40 over Berthoud Pass",
    directFlightAirport: null,
    badge: { label: "Closest to Denver", tone: "pine" },
    costRangePerPerson: [700, 1000],
    tiles: [
      {
        tileLabel: "On the mountain",
        bullets: [
          "Biggest terrain pool of the three",
          "Unlimited on the full Ikon Pass — the Session Pass most of us will buy still blacks out Jan 16–17 and Feb 13–14",
          "Mary Jane side has legendary bumps and glades if anyone wants more",
        ],
      },
      {
        tileLabel: "Getting around",
        bullets: [
          "Small enough to walk most of downtown",
          "A car helps for restaurant-hopping to nearby Fraser",
        ],
      },
      {
        tileLabel: "Food, drink & town",
        bullets: [
          "Deno's Mountain Bistro — aged steaks, pizzas, a Winter Park fixture",
          "Hernando's Pizza Pub — family-run since 1967",
          "Fontenot's Fresh Seafood & Grill — Cajun/Creole, in Winter Park since 1990",
        ],
      },
      {
        tileLabel: "Off the snow",
        bullets: [
          "Fraser Tubing Hill for anyone sitting out a ski day",
          "Low-key, farmers-market feel rather than resort-village feel",
        ],
      },
    ],
    sources: [
      {
        label: "Winter Park Resort, Ikon Session Pass blackout dates",
        url: "https://www.ikonpass.com/en/local-passes/winter-park-resort/season-pass",
      },
      { label: "Mary Jane terrain", url: "https://www.winterparkresort.com/the-mountain/mountain-information/mary-jane" },
      { label: "Deno's Mountain Bistro", url: "https://www.denoswp.com/" },
      { label: "Hernando's Pizza Pub", url: "https://hernandospizzapub.com/" },
      { label: "Fontenot's Fresh Seafood & Grill", url: "https://www.fontenotswp.com/" },
      { label: "Fraser Tubing Hill", url: "https://www.frasertubinghill.com/" },
      { label: "Berthoud Pass route", url: "https://www.uncovercolorado.com/activities/berthoud-pass/" },
    ],
  },
];
