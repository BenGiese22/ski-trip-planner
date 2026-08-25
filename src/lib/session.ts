/**
 * Cookie-based identity, no auth library. The cookie remembers *this browser*;
 * Postgres remembers the data. See PLAN.md section 6.
 */

/** Renaming this orphans every response already in the wild. Don't. */
export const IDENTITY_COOKIE = "ski_trip_token";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createCookieToken(): string {
  return crypto.randomUUID();
}

/**
 * Guards the boundary between an attacker-controlled cookie value and a
 * uuid-typed WHERE clause. Checking the shape here means a malformed token is
 * a miss rather than a database error.
 */
export function isValidCookieToken(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export type IdentityCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * `secure` is caller-supplied rather than hardcoded: a secure cookie is
 * dropped over plain http, so hardcoding it true would break local dev and
 * the e2e suite against http://localhost:3000 — the form would look like it
 * saved, then fail to recognise the visitor on return.
 */
export function identityCookieOptions({
  secure,
}: {
  secure: boolean;
}): IdentityCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  };
}

/**
 * Read the scheme off the request rather than inferring it from NODE_ENV.
 * The e2e suite runs a production build over http://localhost, so an
 * env-based guess would mark the cookie secure there and the browser would
 * drop it — the returning-visitor flow would fail for reasons that look
 * nothing like the cause. Vercel terminates TLS upstream, hence the
 * x-forwarded-proto check ahead of the URL.
 */
export function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}
