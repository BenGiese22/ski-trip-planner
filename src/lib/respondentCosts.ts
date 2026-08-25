import { costAssumptions } from "@/data/costAssumptions";
import type { DestinationSlug } from "@/data/types";
import type { Respondent } from "@/db/schema";
import { estimateTripCost, type SkiDays, type TripCostEstimate } from "./costs";

/**
 * A pass holder's `ski_days` is null (section 16, decision 6), so anything
 * that scales off ski days — the rental line — has nothing to work from.
 * Assume a two-day weekend, and surface the assumption via `assumedSkiDays`
 * so the breakdown can caption it rather than burying it in the arithmetic.
 */
export const PASS_HOLDER_ASSUMED_SKI_DAYS = 2 satisfies SkiDays;

export type PersonCost = {
  label: string;
  estimate: TripCostEstimate;
  /** True when the figures lean on PASS_HOLDER_ASSUMED_SKI_DAYS. */
  assumedSkiDays: boolean;
};

export type RespondentCostBreakdown = {
  people: PersonCost[];
  total: [number, number];
};

type PersonInputs = {
  label: string;
  skiDays: SkiDays | null;
  gearStatus: Respondent["gearStatus"];
  alreadyHasPass: boolean;
};

function costFor(
  person: PersonInputs,
  respondent: Respondent,
  destinationSlug: DestinationSlug,
): PersonCost {
  const skiDays = person.skiDays ?? PASS_HOLDER_ASSUMED_SKI_DAYS;

  // Only flag the assumption when something actually depends on it. A pass
  // holder bringing their own gear has no pass line and no rental line, so
  // ski days never enter their total and captioning one would be noise.
  const scalesOffSkiDays = !person.alreadyHasPass || person.gearStatus === "rental";
  const assumedSkiDays = person.skiDays === null && scalesOffSkiDays;

  return {
    label: person.label,
    assumedSkiDays,
    estimate: estimateTripCost({
      airport: respondent.homeAirport,
      destinationSlug,
      skiDays,
      gearStatus: person.gearStatus,
      alreadyHasPass: person.alreadyHasPass,
      nights: costAssumptions.tripLength.nights,
      foodDays: costAssumptions.tripLength.foodDays,
    }),
  };
}

/**
 * Turns a stored respondent row into the per-person cost tables the guest
 * sees. Both people are priced independently — one partner skiing three days
 * while the other skis one is a completely normal split (section 8).
 *
 * Deliberately tolerant of half-filled rows: autosave means an incomplete
 * respondent is the normal mid-session state, and the breakdown has to render
 * something rather than throw.
 */
export function respondentCostBreakdown(
  respondent: Respondent,
  destinationSlug: DestinationSlug,
): RespondentCostBreakdown {
  const people: PersonCost[] = [
    costFor(
      {
        label: "You",
        skiDays: respondent.skiDays,
        gearStatus: respondent.gearStatus,
        alreadyHasPass: respondent.alreadyHasPass,
      },
      respondent,
      destinationSlug,
    ),
  ];

  if (respondent.plusOne) {
    people.push(
      costFor(
        {
          // Third person throughout — a first-person label under someone
          // else's name reads as a copy bug (section 8).
          label: "Your plus-one",
          skiDays: respondent.plusOneSkiDays,
          gearStatus: respondent.plusOneGearStatus,
          alreadyHasPass: respondent.plusOneAlreadyHasPass,
        },
        respondent,
        destinationSlug,
      ),
    );
  }

  const total = people.reduce<[number, number]>(
    (acc, person) => [acc[0] + person.estimate.total[0], acc[1] + person.estimate.total[1]],
    [0, 0],
  );

  return { people, total };
}
