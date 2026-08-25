import type { DestinationSlug } from "@/data/types";
import type { Respondent } from "@/db/schema";

export type FinishProblem = {
  field: string;
  message: string;
};

export type FinishContext = {
  /** Best first; empty means they haven't ranked the destinations yet. */
  destinationRanking: DestinationSlug[];
  availableDayCount: number;
};

/**
 * Autosave deliberately doesn't validate — a half-filled row mid-session is
 * fine (PLAN.md section 6). "Save & finish" is the one point where it's fair
 * to ask for the missing pieces, so this is where the response is checked
 * against what actually makes it useful to Ben.
 *
 * Returns every problem at once. Revealing them one at a time turns a short
 * form into a guessing game.
 */
export function finishProblems(
  respondent: Respondent,
  { destinationRanking, availableDayCount }: FinishContext,
): FinishProblem[] {
  const problems: FinishProblem[] = [];

  if (destinationRanking.length === 0) {
    problems.push({
      field: "destinationRanking",
      message: "Put the destinations in the order you'd prefer them.",
    });
  }

  if (availableDayCount === 0) {
    problems.push({
      field: "availability",
      message: "Mark at least one day you could go.",
    });
  }

  // A pass holder has no ski-days answer by design — null is how that's
  // stored (section 16, decision 6), not a gap in the response.
  if (respondent.skiDays === null && !respondent.alreadyHasPass) {
    problems.push({
      field: "skiDays",
      message: "Tell us how many days you'd ski, or that you already have a pass.",
    });
  }

  if (respondent.gearStatus === null) {
    problems.push({
      field: "gearStatus",
      message: "Let us know whether you need a rental.",
    });
  }

  // Stale plus-one values can linger after someone switches the toggle back
  // to solo, so these only matter when a plus-one is actually coming.
  if (respondent.plusOne) {
    if (respondent.plusOneSkiDays === null && !respondent.plusOneAlreadyHasPass) {
      problems.push({
        field: "plusOneSkiDays",
        message:
          "Tell us how many days your plus-one would ski, or that they already have a pass.",
      });
    }

    if (respondent.plusOneGearStatus === null) {
      problems.push({
        field: "plusOneGearStatus",
        message: "Let us know whether your plus-one needs a rental.",
      });
    }
  }

  return problems;
}
