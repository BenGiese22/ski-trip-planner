import { costAssumptions } from "@/data/costAssumptions";
import type { AirportCode, DestinationSlug } from "@/data/types";

export type GearStatus = "own" | "rental";
export type SkiDays = 1 | 2 | 3;

export type TripCostInput = {
  airport: AirportCode;
  destinationSlug: DestinationSlug;
  skiDays: SkiDays;
  /** Null while the person hasn't answered the gear question yet. */
  gearStatus: GearStatus | null;
  nights: number;
  foodDays: number;
  /**
   * Ben and Megan already hold the Base Pass, and a guest might too. Their
   * lift access is already paid for, so that line drops out entirely — the
   * same treatment gear owners get for the rental line, and for the same
   * reason: a $0 row invites more questions than an absent one.
   */
  alreadyHasPass?: boolean;
};

export type CostLineItem = {
  label: string;
  range: [number, number];
};

export type TripCostEstimate = {
  lineItems: CostLineItem[];
  total: [number, number];
};

function scaleRange([low, high]: readonly [number, number], by: number): [number, number] {
  return [low * by, high * by];
}

export function estimateTripCost(input: TripCostInput): TripCostEstimate {
  const {
    airport,
    destinationSlug,
    skiDays,
    gearStatus,
    nights,
    foodDays,
    alreadyHasPass = false,
  } = input;
  const lineItems: CostLineItem[] = [];

  lineItems.push({
    label: `Flight, round trip (${airport})`,
    range: [...costAssumptions.flightRangeByAirport[airport]],
  });

  lineItems.push({
    label: `Lodging, ${nights} nights`,
    range: scaleRange(costAssumptions.lodgingPerNightByDestination[destinationSlug], nights),
  });

  if (alreadyHasPass) {
    // No pass line at all — see TripCostInput.alreadyHasPass.
  } else if (skiDays === 1) {
    const ticketRange = costAssumptions.oneDayLiftTicketByDestination[destinationSlug];
    lineItems.push({
      label: "1-day lift ticket",
      range: [...ticketRange],
    });
  } else {
    const pass = costAssumptions.ikonSessionPassByDays[skiDays];
    lineItems.push({
      label: `${skiDays}-day Ikon Session Pass`,
      range: [pass.standard, pass.standard],
    });
  }

  if (gearStatus === "rental") {
    lineItems.push({
      label: `Rental package, ${skiDays} days`,
      range: scaleRange(costAssumptions.rentalPackagePerDayByDays.default, skiDays),
    });
  }

  lineItems.push({
    label: `Food & après, ${foodDays} days`,
    range: scaleRange(costAssumptions.foodAndApresPerDay, foodDays),
  });

  const total: [number, number] = [
    lineItems.reduce((sum, item) => sum + item.range[0], 0),
    lineItems.reduce((sum, item) => sum + item.range[1], 0),
  ];

  return { lineItems, total };
}
