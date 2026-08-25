import type { Airport } from "./types";

// HDN (Steamboat / Hayden) winter 2026-27 nonstop roster: 18 airports via six
// airlines, season runs Dec 10 2026 - April 2027. SFO (United), ORD
// (American) and MSP (Delta) are all on it; MKE is not, so Milwaukee
// connects through DEN either way.
export const airports: Airport[] = [
  {
    code: "SFO",
    city: "San Francisco",
    hdnDirectSeasonal: true,
    sources: [
      {
        label: "Winter air service from Hayden to fly to 18 airports nonstop",
        url: "https://www.steamboatradio.com/2026/08/17/winter-air-service-from-hayden-to-fly-to-18-airports-nonstop/",
      },
    ],
  },
  {
    code: "ORD",
    city: "Chicago",
    hdnDirectSeasonal: true,
    sources: [
      {
        label: "Steamboat Resort — American Airlines winter service",
        url: "https://www.steamboat.com/plan-your-trip/getting-here-and-around/flights/airline-specials/american-airlines",
      },
    ],
  },
  {
    code: "MSP",
    city: "Minneapolis-St. Paul",
    hdnDirectSeasonal: true,
    sources: [
      {
        label: "Winter air service from Hayden to fly to 18 airports nonstop",
        url: "https://www.steamboatradio.com/2026/08/17/winter-air-service-from-hayden-to-fly-to-18-airports-nonstop/",
      },
      {
        label: "Steamboat Chamber — winter flight schedule (Delta is the only MSP-HDN nonstop)",
        url: "https://www.steamboatchamber.com/plan-your-trip/getting-here/flying/winter-schedule/",
      },
    ],
  },
  {
    code: "MKE",
    city: "Milwaukee",
    hdnDirectSeasonal: false,
    sources: [
      {
        label: "Steamboat Chamber — winter flight schedule (18-airport roster)",
        url: "https://www.steamboatchamber.com/plan-your-trip/getting-here/flying/winter-schedule/",
      },
    ],
  },
];
