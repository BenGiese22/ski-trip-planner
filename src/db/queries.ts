import { and, eq } from "drizzle-orm";
import type { DestinationSlug } from "@/data/types";
import type { AvailabilityBulkInput, IntakeInput, RespondentPatch } from "@/lib/schemas";
import { getDb } from "./client";
import {
  availability,
  destinationVotes,
  respondents,
  type AvailabilityRow,
  type Respondent,
} from "./schema";

export async function findRespondentByToken(token: string): Promise<Respondent | null> {
  const rows = await getDb()
    .select()
    .from(respondents)
    .where(eq(respondents.cookieToken, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function createRespondent(
  intake: IntakeInput,
  cookieToken: string,
): Promise<Respondent> {
  const [row] = await getDb()
    .insert(respondents)
    .values({ ...intake, cookieToken })
    .returning();
  return row;
}

/**
 * The destination preference lives in `destination_votes`, not on the
 * respondent row, so it's split out of the patch before the update. Phase 2
 * writes a single rank-1 vote (section 16, decision 3); the table keeps the
 * ranked shape so multi-destination ranking can land later.
 */
export async function updateRespondent(
  respondent: Respondent,
  patch: RespondentPatch,
): Promise<Respondent> {
  const { destinationSlug, ...columns } = patch;
  const db = getDb();

  if (destinationSlug) {
    await setDestinationVote(respondent.id, destinationSlug);
  }

  if (Object.keys(columns).length === 0) {
    return respondent;
  }

  const [row] = await db
    .update(respondents)
    .set({ ...columns, updatedAt: new Date() })
    .where(eq(respondents.id, respondent.id))
    .returning();
  return row;
}

/** Explicit endpoint, separate from autosave — see PLAN.md section 6. */
export async function markSubmitted(respondent: Respondent): Promise<Respondent> {
  const now = new Date();
  const [row] = await getDb()
    .update(respondents)
    .set({ submittedAt: now, updatedAt: now })
    .where(eq(respondents.id, respondent.id))
    .returning();
  return row;
}

export async function setDestinationVote(
  respondentId: string,
  destinationSlug: DestinationSlug,
): Promise<void> {
  const db = getDb();
  // One choice at a time in Phase 2, so clear any previous pick rather than
  // accumulating a second rank-1 row for a different destination.
  await db.delete(destinationVotes).where(eq(destinationVotes.respondentId, respondentId));
  await db.insert(destinationVotes).values({ respondentId, destinationSlug, rank: 1 });
}

export async function getDestinationVote(
  respondentId: string,
): Promise<DestinationSlug | null> {
  const rows = await getDb()
    .select()
    .from(destinationVotes)
    .where(
      and(eq(destinationVotes.respondentId, respondentId), eq(destinationVotes.rank, 1)),
    )
    .limit(1);
  return rows[0]?.destinationSlug ?? null;
}

export async function getAvailability(respondentId: string): Promise<AvailabilityRow[]> {
  return getDb()
    .select()
    .from(availability)
    .where(eq(availability.respondentId, respondentId));
}

/**
 * Replace-all rather than upsert-each: the client sends the days it has set,
 * so a day the person cleared is absent from the payload and has to be
 * deleted. Upserting alone would leave it behind as a stale "available".
 * At most 59 rows per person, so the whole set is cheap to rewrite.
 */
export async function replaceAvailability(
  respondentId: string,
  entries: AvailabilityBulkInput["entries"],
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(availability).where(eq(availability.respondentId, respondentId));
    if (entries.length > 0) {
      await tx.insert(availability).values(entries.map((entry) => ({ respondentId, ...entry })));
    }
  });
}
