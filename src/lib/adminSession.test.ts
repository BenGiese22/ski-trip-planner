import { describe, expect, it, vi, afterEach } from "vitest";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MS,
  adminCookieOptions,
  isCorrectPasscode,
  signAdminSession,
  verifyAdminSession,
} from "./adminSession";

const SECRET = "test-cookie-secret-not-the-passcode";
const PASSCODE = "correct-horse";

afterEach(() => {
  vi.useRealTimers();
});

describe("isCorrectPasscode", () => {
  it("accepts the right passcode", () => {
    expect(isCorrectPasscode(PASSCODE, PASSCODE)).toBe(true);
  });

  it("rejects the wrong one", () => {
    expect(isCorrectPasscode("nope", PASSCODE)).toBe(false);
  });

  // Comparing raw strings of different lengths either throws in
  // timingSafeEqual or short-circuits before it, which leaks length. Hashing
  // both sides first makes every comparison fixed-width.
  it("rejects without throwing when the lengths differ wildly", () => {
    expect(isCorrectPasscode("", PASSCODE)).toBe(false);
    expect(isCorrectPasscode("x".repeat(10_000), PASSCODE)).toBe(false);
  });

  it("is case- and whitespace-sensitive", () => {
    expect(isCorrectPasscode(PASSCODE.toUpperCase(), PASSCODE)).toBe(false);
    expect(isCorrectPasscode(` ${PASSCODE} `, PASSCODE)).toBe(false);
  });

  it("rejects everything when no passcode is configured", () => {
    // A missing ADMIN_PASSCODE must fail closed. Treating undefined as
    // "matches anything" would leave /admin wide open on a misconfigured
    // deploy — the worst possible failure direction.
    expect(isCorrectPasscode("anything", undefined)).toBe(false);
    expect(isCorrectPasscode("", undefined)).toBe(false);
    expect(isCorrectPasscode("anything", "")).toBe(false);
  });
});

describe("signAdminSession / verifyAdminSession", () => {
  it("round-trips a freshly signed session", () => {
    expect(verifyAdminSession(signAdminSession(SECRET), SECRET)).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const token = signAdminSession(SECRET);
    const [payload, signature] = token.split(".");
    const flipped = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    expect(verifyAdminSession(`${payload}.${flipped}`, SECRET)).toBe(false);
  });

  // The whole point of signing: extending your own expiry must not verify.
  it("rejects a payload edited to push the expiry out", () => {
    const token = signAdminSession(SECRET);
    const signature = token.split(".")[1];
    const forged = `${Date.now() + 10 * ADMIN_SESSION_MS}.${signature}`;
    expect(verifyAdminSession(forged, SECRET)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    expect(verifyAdminSession(signAdminSession("some-other-secret"), SECRET)).toBe(false);
  });

  it("rejects an expired session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const token = signAdminSession(SECRET);

    vi.setSystemTime(new Date("2027-01-01T00:00:00Z").getTime() + ADMIN_SESSION_MS - 1000);
    expect(verifyAdminSession(token, SECRET)).toBe(true);

    vi.setSystemTime(new Date("2027-01-01T00:00:00Z").getTime() + ADMIN_SESSION_MS + 1000);
    expect(verifyAdminSession(token, SECRET)).toBe(false);
  });

  it.each([
    ["an empty string", ""],
    ["no separator", "abcdef"],
    ["a non-numeric payload", "not-a-number.abcdef"],
    ["too many segments", "1.2.3"],
    ["a missing signature", "123456789."],
    ["undefined", undefined],
    ["a number", 42],
  ])("rejects %s rather than throwing", (_label, value) => {
    expect(verifyAdminSession(value as unknown as string, SECRET)).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    const token = signAdminSession(SECRET);
    expect(verifyAdminSession(token, undefined)).toBe(false);
    expect(verifyAdminSession(token, "")).toBe(false);
  });

  it("expires 12 hours out, per section 17 decision 7", () => {
    expect(ADMIN_SESSION_MS).toBe(12 * 60 * 60 * 1000);
  });
});

describe("adminCookieOptions", () => {
  it("is httpOnly so page script can never read the admin session", () => {
    expect(adminCookieOptions({ secure: true }).httpOnly).toBe(true);
  });

  // Tighter than the guest identity cookie's "lax": there is no legitimate
  // cross-site navigation into /admin, so nothing is lost by refusing it.
  it("is sameSite strict, unlike the guest identity cookie", () => {
    expect(adminCookieOptions({ secure: true }).sameSite).toBe("strict");
  });

  // Scoped to /admin so it is never attached to guest-facing requests. A
  // path of "/" would send the admin session on every visitor's page load.
  it("is scoped to /admin, not the whole site", () => {
    expect(adminCookieOptions({ secure: true }).path).toBe("/admin");
  });

  it("lives exactly as long as the signed session claims to", () => {
    expect(adminCookieOptions({ secure: true }).maxAge).toBe(ADMIN_SESSION_MS / 1000);
  });

  it("follows the request scheme, so e2e over http still works", () => {
    expect(adminCookieOptions({ secure: true }).secure).toBe(true);
    expect(adminCookieOptions({ secure: false }).secure).toBe(false);
  });

  it("uses a different cookie name from the guest identity cookie", () => {
    expect(ADMIN_COOKIE).toBe("ski_trip_admin");
    expect(ADMIN_COOKIE).not.toBe("ski_trip_token");
  });
});
