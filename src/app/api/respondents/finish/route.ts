import { NextResponse } from "next/server";
import { getAvailability, getDestinationRanking, markSubmitted } from "@/db/queries";
import { noSuchRespondent } from "@/lib/api";
import { finishProblems } from "@/lib/finish";
import { currentRespondent, loadClientResponse } from "@/lib/serverSession";

/**
 * "Save & finish" — the explicit endpoint that sets `submitted_at`. Autosave
 * already made the data durable; this marks it final, which is what lets Ben's
 * admin view tell "still filling this in" from "considers this their answer"
 * (PLAN.md section 6).
 *
 * This is the one place validation is fair to apply, so it's the only write
 * path that can refuse.
 */
export async function POST() {
  const respondent = await currentRespondent();
  if (!respondent) return noSuchRespondent();

  const [destinationRanking, availabilityRows] = await Promise.all([
    getDestinationRanking(respondent.id),
    getAvailability(respondent.id),
  ]);

  const problems = finishProblems(respondent, {
    destinationRanking,
    availableDayCount: availabilityRows.filter((row: { status: string }) => row.status !== "unavailable")
      .length,
  });

  if (problems.length > 0) {
    return NextResponse.json({ problems }, { status: 422 });
  }

  const submitted = await markSubmitted(respondent);
  return NextResponse.json({ response: await loadClientResponse(submitted) });
}
