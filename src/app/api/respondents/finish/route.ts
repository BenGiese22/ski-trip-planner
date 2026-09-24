import { NextResponse } from "next/server";
import { finishResponse, getAvailability, getDestinationRanking } from "@/db/queries";
import { guestWriteLimit, noSuchRespondent } from "@/lib/api";
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
 *
 * Finishing is also the direction-B undo (§19): a successful finish clears
 * any decline on this browser's token in the same transaction. The 422 below
 * returns before that write, so an incomplete answer leaves the decline alone.
 */
export async function POST(request: Request) {
  const limited = await guestWriteLimit(request);
  if (limited) return limited;

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

  const submitted = await finishResponse(respondent);
  return NextResponse.json({ response: await loadClientResponse(submitted) });
}
