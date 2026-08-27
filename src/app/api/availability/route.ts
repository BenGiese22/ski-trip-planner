import { NextResponse } from "next/server";
import { replaceAvailability } from "@/db/queries";
import { badRequest, noSuchRespondent, guestWriteLimit, readJson } from "@/lib/api";
import { availabilityBulkSchema } from "@/lib/schemas";
import { currentRespondent, loadClientResponse } from "@/lib/serverSession";

/**
 * Bulk-replaces this respondent's day statuses. The client sends the full set
 * it currently has selected, so a day the person cleared simply isn't in the
 * payload — see replaceAvailability for why that rules out a plain upsert.
 */
export async function POST(request: Request) {
  const limited = await guestWriteLimit(request);
  if (limited) return limited;

  const respondent = await currentRespondent();
  if (!respondent) return noSuchRespondent();

  const parsed = availabilityBulkSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest(parsed.error);

  await replaceAvailability(respondent.id, parsed.data.entries);
  return NextResponse.json({ response: await loadClientResponse(respondent) });
}
