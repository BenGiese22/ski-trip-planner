export type Source = { label: string; url: string };

export type DetailTile = {
  tileLabel: string;
  bullets: string[];
};

export type DestinationSlug = "steamboat" | "summitCounty" | "winterPark";

export type Destination = {
  slug: DestinationSlug;
  name: string;
  mountain: string;
  passAccess: "unlimited" | "5-day, blackout dates";
  driveTimeFromDenver: string;
  driveNote?: string;
  directFlightAirport: "HDN" | null;
  badge: { label: string; tone: "gold" | "pine" };
  tiles: [DetailTile, DetailTile, DetailTile, DetailTile];
  costRangePerPerson: [number, number];
  sources: Source[];
};

export type AirportCode = "SFO" | "ORD" | "MKE" | "MSP";

export type Airport = {
  code: AirportCode;
  city: string;
  hdnDirectSeasonal: boolean;
  sources: Source[];
};
