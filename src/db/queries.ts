import { and, eq, lt, sql } from "drizzle-orm";
import type { DestinationSlug } from "@/data/types";
import type { AvailabilityBulkInput, IntakeInput, RespondentPatch } from "@/lib/schemas";
import {
  PRUNE_AFTER_MS,
  currentWindowStart,
  isAllowed,
  retryAfterMs,
  type RateLimitConfig,
} from "@/lib/rateLimit";
import { getDb } from "./client";
import {
  availability,
  destinationVotes,
  rateLimits,
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

/**
 * Increments this bucket's counter and reports whether the request may
 * proceed. The increment and the read happen in one statement — a
 * check-then-increment would let two concurrent requests both observe a count
 * under the limit and both be allowed through.
 *
 * Also prunes windows past PRUNE_AFTER_MS while it's here, so the table can't
 * grow without bound (§17 decision 6). Doing it inline avoids a cron job for
 * what is, at this scale, a handful of rows a day.
 */
export async function hitRateLimit(
  key: string,
  { limit, windowMs }: RateLimitConfig,
  now: number = Date.now(),
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const db = getDb();
  const windowStart = new Date(currentWindowStart(now, windowMs));

  const [row] = await db
    .insert(rateLimits)
    .values({ bucketKey: key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.bucketKey, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  // Best-effort: a failed prune must never fail the request it rode in on.
  void db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now - PRUNE_AFTER_MS)))
    .catch(() => {});

  return {
    allowed: isAllowed(row.count, limit),
    retryAfterMs: retryAfterMs(now, windowStart.getTime(), windowMs),
  };
}
