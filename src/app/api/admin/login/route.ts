import { NextResponse } from "next/server";
import { z } from "zod";
import { hitRateLimit } from "@/db/queries";
import { badRequest, readJson } from "@/lib/api";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  isCorrectPasscode,
  signAdminSession,
} from "@/lib/adminSession";
import {
  ADMIN_LOGIN_LIMIT,
  bucketKey,
  clientIdFromRequest,
} from "@/lib/rateLimit";
import { isSecureRequest } from "@/lib/session";

// Its own schema rather than one from lib/schemas.ts — different domain, and
// nothing else should be able to grow this payload by accident.
const loginSchema = z.strictObject({
  passcode: z.string().min(1).max(200),
});

/**
 * The passcode gate (PLAN.md §6, §17 decision 1). Rate-limited before the
 * comparison runs, so a brute-force attempt is stopped by the limiter rather
 * than by the strength of the passcode (§14 puts throttling here specifically,
 * not in a later hardening pass).
 */
export async function POST(request: Request) {
  // The limiter lives in Postgres, so a database outage would otherwise throw
  // here and surface as an unhandled 500 before the passcode is even read.
  // Fail closed rather than open: skipping the limit when the store is
  // unreachable would hand an attacker a trivial bypass, and the dashboard
  // needs that same database anyway, so letting anyone in would achieve
  // nothing.
  let limit;
  try {
    limit = await hitRateLimit(
      bucketKey("admin-login", clientIdFromRequest(request)),
      ADMIN_LOGIN_LIMIT,
    );
  } catch {
    return NextResponse.json(
      { error: "Can't reach the database right now. Try again in a moment." },
      { status: 503 },
    );
  }

  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many attempts. Try again in a few minutes.",
        retryAfterMs: limit.retryAfterMs,
      },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest(parsed.error);

  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!isCorrectPasscode(parsed.data.passcode, process.env.ADMIN_PASSCODE) || !secret) {
    // One generic message either way. Distinguishing "wrong passcode" from
    // "server misconfigured" would tell an attacker which of the two they're
    // looking at, and neither is actionable for a legitimate user.
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_COOKIE,
    signAdminSession(secret),
    adminCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}
