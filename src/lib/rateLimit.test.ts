import { describe, expect, it } from "vitest";
import {
  ADMIN_LOGIN_LIMIT,
  GUEST_WRITE_LIMIT,
  PRUNE_AFTER_MS,
  bucketKey,
  currentWindowStart,
  isAllowed,
  isStaleWindow,
  retryAfterMs,
} from "./rateLimit";

const MINUTE = 60_000;

describe("currentWindowStart", () => {
  it("floors a timestamp to the start of its window", () => {
    // 14:07:30 in five-minute windows belongs to the 14:05 bucket.
    const t = Date.UTC(2027, 0, 28, 14, 7, 30);
    expect(currentWindowStart(t, 5 * MINUTE)).toBe(Date.UTC(2027, 0, 28, 14, 5, 0));
  });

  it("puts two times inside the same window in the same bucket", () => {
    const a = Date.UTC(2027, 0, 28, 14, 5, 1);
    const b = Date.UTC(2027, 0, 28, 14, 9, 59);
    expect(currentWindowStart(a, 5 * MINUTE)).toBe(currentWindowStart(b, 5 * MINUTE));
  });

  it("puts times either side of a boundary in different buckets", () => {
    const before = Date.UTC(2027, 0, 28, 14, 9, 59);
    const after = Date.UTC(2027, 0, 28, 14, 10, 0);
    expect(currentWindowStart(before, 5 * MINUTE)).not.toBe(
      currentWindowStart(after, 5 * MINUTE),
    );
  });

  it("treats a timestamp exactly on a boundary as starting the new window", () => {
    const t = Date.UTC(2027, 0, 28, 14, 10, 0);
    expect(currentWindowStart(t, 5 * MINUTE)).toBe(t);
  });
});

describe("isAllowed", () => {
  // The DB increments and returns the new count, so the value passed here is
  // the count *including* the request being judged. The Nth request of a
  // limit-N window is the last allowed one.
  it("allows requests up to and including the limit", () => {
    expect(isAllowed(1, 5)).toBe(true);
    expect(isAllowed(5, 5)).toBe(true);
  });

  it("denies the request that goes past the limit", () => {
    expect(isAllowed(6, 5)).toBe(false);
    expect(isAllowed(99, 5)).toBe(false);
  });
});

describe("retryAfterMs", () => {
  it("reports the time left until the window rolls over", () => {
    const windowStart = Date.UTC(2027, 0, 28, 14, 5, 0);
    const now = Date.UTC(2027, 0, 28, 14, 7, 0);
    expect(retryAfterMs(now, windowStart, 5 * MINUTE)).toBe(3 * MINUTE);
  });

  it("never reports a negative wait", () => {
    const windowStart = Date.UTC(2027, 0, 28, 14, 5, 0);
    const now = Date.UTC(2027, 0, 28, 14, 30, 0);
    expect(retryAfterMs(now, windowStart, 5 * MINUTE)).toBe(0);
  });
});

describe("isStaleWindow", () => {
  // Section 17 decision 6: every new (bucket, window) pair inserts a row that
  // is never read again. Without pruning the table grows without bound.
  it("prunes windows older than 12 hours", () => {
    expect(PRUNE_AFTER_MS).toBe(12 * 60 * 60 * 1000);
  });

  it("keeps a window from a few minutes ago", () => {
    const now = Date.UTC(2027, 0, 28, 14, 0, 0);
    expect(isStaleWindow(now - 10 * MINUTE, now)).toBe(false);
  });

  it("marks a window from yesterday as stale", () => {
    const now = Date.UTC(2027, 0, 28, 14, 0, 0);
    expect(isStaleWindow(now - 24 * 60 * MINUTE, now)).toBe(true);
  });

  it("keeps a window sitting exactly on the cutoff", () => {
    const now = Date.UTC(2027, 0, 28, 14, 0, 0);
    expect(isStaleWindow(now - PRUNE_AFTER_MS, now)).toBe(false);
    expect(isStaleWindow(now - PRUNE_AFTER_MS - 1, now)).toBe(true);
  });
});

describe("bucketKey", () => {
  it("separates the same client across different routes", () => {
    expect(bucketKey("admin-login", "203.0.113.7")).not.toBe(
      bucketKey("guest-write", "203.0.113.7"),
    );
  });

  it("separates different clients on the same route", () => {
    expect(bucketKey("admin-login", "203.0.113.7")).not.toBe(
      bucketKey("admin-login", "198.51.100.2"),
    );
  });

  it("is stable for the same route and client", () => {
    expect(bucketKey("admin-login", "203.0.113.7")).toBe(
      bucketKey("admin-login", "203.0.113.7"),
    );
  });

  // Without an identifiable client every caller shares one bucket, which is
  // the safe direction: it over-limits rather than under-limits.
  it("falls back to a shared bucket when the client is unknown", () => {
    expect(bucketKey("admin-login", null)).toBe(bucketKey("admin-login", null));
    expect(bucketKey("admin-login", null)).not.toBe(
      bucketKey("admin-login", "203.0.113.7"),
    );
  });
});

describe("configured limits", () => {
  // Section 17 decision 8.
  it("allows 5 login attempts per 5 minutes", () => {
    expect(ADMIN_LOGIN_LIMIT).toEqual({ limit: 5, windowMs: 5 * MINUTE });
  });

  it("allows 300 guest writes per minute", () => {
    expect(GUEST_WRITE_LIMIT).toEqual({ limit: 300, windowMs: MINUTE });
  });

  // This assertion caught the original 60/min figure as too low to ship:
  // the 700ms debounce alone permits ~86 writes/minute, and drag-painting the
  // calendar saves on change rather than on a debounce, so it emits roughly
  // one request per round trip. The limit has to clear the legitimate
  // ceiling with room to spare, or fast guests get locked out of their own
  // form.
  it("leaves headroom over what autosave can legitimately produce", () => {
    const debounceCeilingPerMinute = 60_000 / 700;
    expect(GUEST_WRITE_LIMIT.limit).toBeGreaterThan(debounceCeilingPerMinute * 3);
  });
});
