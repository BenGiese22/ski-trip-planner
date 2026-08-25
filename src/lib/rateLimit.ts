/**
 * Fixed-window rate limiting (PLAN.md §14, §17 decision 8). Backed by Postgres
 * rather than process memory: Fluid Compute reuses instances for concurrent
 * requests but gives no guarantee across a cold start, a scale-out, or a
 * redeploy — and a brute-force script that triggers scale-out would otherwise
 * reset its own limit for free, on the one route §14 calls the sensitive
 * surface.
 *
 * Everything in this file is pure. The database side lives in
 * `src/db/queries.ts`.
 */

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

export const ADMIN_LOGIN_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 5 * 60_000,
};

/**
 * Deliberately generous. This is a backstop against someone scripting the
 * public endpoints, not a quota on real use — and real use can be burstier
 * than it looks. The 700ms autosave debounce alone permits ~86 writes/minute,
 * and §6 asks the calendar grid to save on change rather than on a debounce,
 * so drag-painting emits roughly one request per network round trip. A limit
 * near the legitimate ceiling would lock out guests who fill the form quickly.
 */
export const GUEST_WRITE_LIMIT: RateLimitConfig = {
  limit: 300,
  windowMs: 60_000,
};

/**
 * §17 decision 6. Each new (bucket, window) pair inserts a row that is never
 * read again; without pruning the table grows without bound. Slow at this
 * scale, but a leak is a leak.
 */
export const PRUNE_AFTER_MS = 12 * 60 * 60 * 1000;

/** Floors a timestamp to the start of the window containing it. */
export function currentWindowStart(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * The count passed here is the value *after* the increment, since the upsert
 * increments and returns in one statement. So the Nth request of a limit-N
 * window is the last one allowed.
 */
export function isAllowed(countIncludingThisRequest: number, limit: number): boolean {
  return countIncludingThisRequest <= limit;
}

export function retryAfterMs(now: number, windowStart: number, windowMs: number): number {
  return Math.max(0, windowStart + windowMs - now);
}

export function isStaleWindow(windowStart: number, now: number): boolean {
  return windowStart < now - PRUNE_AFTER_MS;
}

/**
 * An unknown client collapses everyone into one shared bucket. That
 * over-limits rather than under-limits, which is the right direction to err:
 * the alternative — skipping the limit when the IP is unreadable — would hand
 * an attacker a trivial bypass.
 */
export function bucketKey(route: string, clientId: string | null): string {
  return `${route}:${clientId ?? "unknown"}`;
}

/**
 * Vercel sets `x-forwarded-for` at the edge, leftmost entry being the client.
 * Locally and in the e2e suite the header is usually absent, which collapses
 * to the shared "unknown" bucket — fine, since tests control their own volume.
 */
export function clientIdFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim();
  return first || null;
}
