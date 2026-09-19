import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { hitRateLimit } from "@/db/queries";
import { GUEST_WRITE_LIMIT, bucketKey, clientIdFromRequest } from "./rateLimit";
import { IDENTITY_COOKIE } from "./session";

export function badRequest(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Invalid request",
      // Field-level detail, not the raw Zod tree — enough for the client to
      // point at the offending input without leaking schema internals.
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

/**
 * A cookie whose row is gone (merged/deleted server-side, or just stale)
 * should stop pointing at nothing — clearing it here means the next load is
 * a clean first visit instead of a browser stuck retrying a write that can
 * never land.
 */
export function noSuchRespondent(): NextResponse {
  const response = NextResponse.json(
    { error: "No response found for this browser. Start with the intake form." },
    { status: 404 },
  );
  response.cookies.delete(IDENTITY_COOKIE);
  return response;
}

/**
 * A malformed body is a 400, not a 500 — `request.json()` throws on invalid
 * JSON and an unhandled throw here would read as a server fault in the logs.
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Throttles the public write endpoints (PLAN.md §14). Returns a response to
 * send back when the caller is over the limit, or null to carry on.
 *
 * Deliberately generous — this is a backstop against someone scripting a
 * public endpoint, not a quota on real use. See GUEST_WRITE_LIMIT for why the
 * number has to clear what autosave can legitimately produce.
 *
 * Fails closed if the limiter itself is unreachable: the handler behind this
 * needs the same database anyway, so letting the request through would only
 * swap a clear 503 for a confusing 500.
 */
export async function guestWriteLimit(request: Request): Promise<NextResponse | null> {
  let limit;
  try {
    limit = await hitRateLimit(
      bucketKey("guest-write", clientIdFromRequest(request)),
      GUEST_WRITE_LIMIT,
    );
  } catch {
    return NextResponse.json(
      { error: "Can't reach the database right now. Your answers aren't lost." },
      { status: 503 },
    );
  }

  if (limit.allowed) return null;

  return NextResponse.json(
    { error: "That's a lot of changes at once — give it a moment." },
    {
      status: 429,
      headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
    },
  );
}
