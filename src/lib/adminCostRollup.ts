import type { DestinationSlug } from "@/data/types";
import type { Respondent } from "@/db/schema";
import { respondentCostBreakdown, type PersonCost } from "./respondentCosts";

export type CostRollupEntry = {
  respondent: Respondent;
  /** Whatever they ranked first, or null if they never ranked anything. */
  topChoice: DestinationSlug | null;
};

export type CostRollupRow = {
  name: string;
  email: string;
  homeAirport: Respondent["homeAirport"];
  destinationSlug: DestinationSlug | null;
  /** One entry per person — two when a plus-one is coming. */
  people: PersonCost[];
  /** How many people this row covers, whether or not they can be priced. */
  headcount: number;
  /** Null when there's no destination to price against. */
  total: [number, number] | null;
  /** True when any figure here leans on the pass-holder ski-days assumption. */
  assumedSkiDays: boolean;
};

export type CostRollup = {
  rows: CostRollupRow[];
  groupTotal: [number, number];
  headcount: number;
};

/**
 * Ben's per-person and group view. Deliberately a thin wrapper over
 * `respondentCostBreakdown()` — the per-person maths, the pass-holder
 * assumption and the dropped rental line all already live there, and having a
 * second implementation would let the guest's estimate and the host's rollup
 * quietly disagree about the same person.
 *
 * A respondent with no ranking is listed but not priced. `finishProblems()`
 * requires a ranking before anyone can submit, so this shouldn't occur — but a
 * stale row must not silently contribute zero to a total being read as
 * complete. Their headcount still counts: they are coming either way.
 */
export function buildCostRollup(entries: CostRollupEntry[]): CostRollup {
  const rows = entries.map(({ respondent, topChoice }): CostRollupRow => {
    const headcount = respondent.plusOne ? 2 : 1;

    if (!topChoice) {
      return {
        name: respondent.name,
        email: respondent.email,
        homeAirport: respondent.homeAirport,
        destinationSlug: null,
        people: [],
        headcount,
        total: null,
        assumedSkiDays: false,
      };
    }

    const breakdown = respondentCostBreakdown(respondent, topChoice);
    return {
      name: respondent.name,
      email: respondent.email,
      homeAirport: respondent.homeAirport,
      destinationSlug: topChoice,
      people: breakdown.people,
      headcount,
      total: breakdown.total,
      assumedSkiDays: breakdown.people.some((person) => person.assumedSkiDays),
    };
  });

  const groupTotal = rows.reduce<[number, number]>(
    (acc, row) => (row.total ? [acc[0] + row.total[0], acc[1] + row.total[1]] : acc),
    [0, 0],
  );

  return {
    rows,
    groupTotal,
    headcount: rows.reduce((sum, row) => sum + row.headcount, 0),
  };
}
