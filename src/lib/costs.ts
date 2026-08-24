import { costAssumptions } from "@/data/costAssumptions";
import type { AirportCode, DestinationSlug } from "@/data/types";

export type GearStatus = "own" | "rental";
export type SkiDays = 1 | 2 | 3;

export type TripCostInput = {
  airport: AirportCode;
  destinationSlug: DestinationSlug;
  skiDays: SkiDays;
  gearStatus: GearStatus;
  nights: number;
  foodDays: number;
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
  const { airport, destinationSlug, skiDays, gearStatus, nights, foodDays } = input;
  const lineItems: CostLineItem[] = [];

  lineItems.push({
    label: `Flight, round trip (${airport})`,
    range: [...costAssumptions.flightRangeByAirport[airport]],
  });

  lineItems.push({
    label: `Lodging, ${nights} nights`,
    range: scaleRange(costAssumptions.lodgingPerNightByDestination[destinationSlug], nights),
  });

  if (skiDays === 1) {
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
