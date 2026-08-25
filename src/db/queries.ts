import { eq, isNotNull, lt, sql } from "drizzle-orm";
import type { DestinationSlug } from "@/data/types";
import type { DayCount } from "@/lib/availabilityHeatmap";
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
  const { destinationRanking, ...columns } = patch;
  const db = getDb();

  // `undefined` means the patch didn't mention it; `null` means take the
  // ranking back. Only the latter should clear the stored rows.
  if (destinationRanking !== undefined) {
    if (destinationRanking === null) await clearDestinationVote(respondent.id);
    else await setDestinationRanking(respondent.id, destinationRanking);
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

/**
 * Writes one row per destination, ranked best first. Replace-all rather than
 * upsert: a reorder changes several rows at once, and rewriting the set is
 * both simpler and impossible to leave half-applied.
 */
export async function setDestinationRanking(
  respondentId: string,
  ranking: DestinationSlug[],
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(destinationVotes).where(eq(destinationVotes.respondentId, respondentId));
    await tx.insert(destinationVotes).values(
      ranking.map((destinationSlug, index) => ({
        respondentId,
        destinationSlug,
        rank: index + 1,
      })),
    );
  });
}

export async function clearDestinationVote(respondentId: string): Promise<void> {
  await getDb()
    .delete(destinationVotes)
    .where(eq(destinationVotes.respondentId, respondentId));
}

/** Best first, or an empty array if this person hasn't ranked anything. */
export async function getDestinationRanking(
  respondentId: string,
): Promise<DestinationSlug[]> {
  const rows = await getDb()
    .select({ destinationSlug: destinationVotes.destinationSlug, rank: destinationVotes.rank })
    .from(destinationVotes)
    .where(eq(destinationVotes.respondentId, respondentId))
    .orderBy(destinationVotes.rank);
  return rows.map((row) => row.destinationSlug);
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

/**
 * Admin reads. Every one of these is filtered to submitted responses only
 * (PLAN.md §17 decision 3) — an abandoned half-filled row shouldn't move any
 * of Ben's numbers.
 */
export async function countSubmittedRespondents(): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(respondents)
    .where(isNotNull(respondents.submittedAt));
  return row?.count ?? 0;
}

/**
 * One row per (date, status), pivoted into the per-day shape the heatmap
 * wants. Counting in SQL and shaping in TypeScript keeps the interesting part
 * — the weighting and tiering — as pure, fast-to-test logic.
 */
export async function availabilityCountsByDate(): Promise<DayCount[]> {
  const rows = await getDb()
    .select({
      date: availability.date,
      status: availability.status,
      count: sql<number>`count(*)::int`,
    })
    .from(availability)
    .innerJoin(respondents, eq(availability.respondentId, respondents.id))
    .where(isNotNull(respondents.submittedAt))
    .groupBy(availability.date, availability.status);

  const byDate = new Map<string, DayCount>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { date: row.date, available: 0, maybe: 0 };
    // "unavailable" is deliberately not counted: it contributes nothing to
    // how good a day looks, and folding it in would only ever be misleading.
    if (row.status === "available") entry.available += row.count;
    else if (row.status === "maybe") entry.maybe += row.count;
    byDate.set(row.date, entry);
  }
  return [...byDate.values()];
}

/**
 * Every finished respondent's full ranking, best first (§17 decision 3).
 * Grouped in TypeScript rather than SQL: at this scale it's a handful of rows,
 * and the shape the tally wants is an array per person.
 */
export async function listSubmittedDestinationRankings(): Promise<DestinationSlug[][]> {
  const rows = await getDb()
    .select({
      respondentId: destinationVotes.respondentId,
      destinationSlug: destinationVotes.destinationSlug,
      rank: destinationVotes.rank,
    })
    .from(destinationVotes)
    .innerJoin(respondents, eq(destinationVotes.respondentId, respondents.id))
    .where(isNotNull(respondents.submittedAt))
    .orderBy(destinationVotes.respondentId, destinationVotes.rank);

  const byRespondent = new Map<string, DestinationSlug[]>();
  for (const row of rows) {
    const list = byRespondent.get(row.respondentId) ?? [];
    list.push(row.destinationSlug);
    byRespondent.set(row.respondentId, list);
  }
  return [...byRespondent.values()];
}
