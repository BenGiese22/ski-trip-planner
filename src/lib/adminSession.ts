import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The admin passcode gate (PLAN.md §6, §17 decision 1). Deliberately separate
 * from the guest identity in `session.ts`: different cookie, different
 * lifetime, different threat model. A leaked identity cookie exposes one
 * guest's own answers; a leaked admin cookie exposes everyone's.
 */
export const ADMIN_COOKIE = "ski_trip_admin";

/** §17 decision 7. */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Hash both sides before comparing. `timingSafeEqual` throws on unequal
 * lengths, so comparing raw passcodes would either crash or force a
 * length check first — and that check leaks the length through timing.
 * Digests are always 32 bytes, so the comparison is genuinely fixed-width.
 */
export function isCorrectPasscode(
  submitted: string,
  configured: string | undefined,
): boolean {
  // Fail closed. Treating a missing ADMIN_PASSCODE as "matches anything" would
  // leave /admin open on a misconfigured deploy — the worst failure direction.
  if (!configured) return false;
  return timingSafeEqual(sha256(submitted), sha256(configured));
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * `<expiresAt>.<hmac>`. The expiry lives in the payload and is covered by the
 * signature, so a client can read when their session ends but can't extend it.
 *
 * Signed with ADMIN_COOKIE_SECRET rather than the passcode (§17 decision 5):
 * with the passcode as key, anyone holding one observed cookie could
 * brute-force a human-chosen passcode offline at full speed, with the login
 * rate limit never involved.
 */
export function signAdminSession(secret: string, now: number = Date.now()): string {
  const payload = String(now + ADMIN_SESSION_MS);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSession(
  token: string | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!secret || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;
  if (!payload || !signature) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;

  const expected = sign(payload, secret);
  // Compare as buffers of equal length; a forged signature of a different
  // length would otherwise throw rather than simply failing.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  return expiresAt > now;
}

export type AdminCookieOptions = {
  httpOnly: true;
  sameSite: "strict";
  secure: boolean;
  path: "/admin";
  maxAge: number;
};

/**
 * `sameSite: strict` and `path: /admin` are both tighter than the guest
 * cookie's. Nothing legitimately navigates cross-site into /admin, and scoping
 * the path keeps the admin session off every guest's page load.
 *
 * `secure` is caller-supplied for the same reason as the guest cookie: the e2e
 * suite runs a production build over http://localhost, and a secure cookie
 * would be silently dropped there.
 */
export function adminCookieOptions({ secure }: { secure: boolean }): AdminCookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/admin",
    maxAge: ADMIN_SESSION_MS / 1000,
  };
}
