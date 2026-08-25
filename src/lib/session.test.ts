import { describe, expect, it } from "vitest";
import {
  IDENTITY_COOKIE,
  createCookieToken,
  identityCookieOptions,
  isSecureRequest,
  isValidCookieToken,
} from "./session";

describe("createCookieToken", () => {
  it("produces a v4 UUID", () => {
    expect(createCookieToken()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("produces a different token each time", () => {
    const tokens = new Set(Array.from({ length: 200 }, createCookieToken));
    expect(tokens.size).toBe(200);
  });
});

describe("isValidCookieToken", () => {
  it("accepts a freshly minted token", () => {
    expect(isValidCookieToken(createCookieToken())).toBe(true);
  });

  // The token goes straight into a uuid-typed WHERE clause. Rejecting
  // anything that isn't a UUID keeps malformed input from reaching the query
  // at all, rather than relying on the driver to complain.
  it.each([
    ["an empty string", ""],
    ["arbitrary text", "hello"],
    ["a SQL fragment", "' OR 1=1 --"],
    ["a truncated uuid", "6f1d2b9e-1c3a-4b5d-8e7f"],
    ["a number", 42],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
  ])("rejects %s", (_label, value) => {
    expect(isValidCookieToken(value)).toBe(false);
  });
});

describe("identityCookieOptions", () => {
  it("is httpOnly so client-side script can never read the token", () => {
    expect(identityCookieOptions({ secure: true }).httpOnly).toBe(true);
  });

  it("is scoped to the whole site and lasts long enough to be a return visit", () => {
    const options = identityCookieOptions({ secure: true });
    expect(options.path).toBe("/");
    // The trip is in early 2027 and people will drift back over months.
    expect(options.maxAge).toBeGreaterThanOrEqual(60 * 60 * 24 * 180);
  });

  it("uses sameSite lax so the link still works when opened from a message", () => {
    expect(identityCookieOptions({ secure: true }).sameSite).toBe("lax");
  });

  // A secure cookie is silently dropped over plain http, which would break
  // local dev and the Playwright suite against http://localhost:3000 — the
  // form would appear to save and then never recognise the visitor.
  it("is secure when served over https", () => {
    expect(identityCookieOptions({ secure: true }).secure).toBe(true);
  });

  it("is not secure over plain http, so local and e2e runs still work", () => {
    expect(identityCookieOptions({ secure: false }).secure).toBe(false);
  });
});

describe("isSecureRequest", () => {
  const req = (url: string, headers: Record<string, string> = {}) =>
    new Request(url, { headers });

  it("treats an https request as secure", () => {
    expect(isSecureRequest(req("https://example.com/api/respondents"))).toBe(true);
  });

  it("treats plain http as not secure", () => {
    expect(isSecureRequest(req("http://localhost:3000/api/respondents"))).toBe(false);
  });

  // Vercel terminates TLS upstream, so the request the handler sees is http
  // and only the forwarded header knows the truth.
  it("trusts x-forwarded-proto ahead of the request URL", () => {
    expect(
      isSecureRequest(
        req("http://localhost:3000/api/respondents", { "x-forwarded-proto": "https" }),
      ),
    ).toBe(true);
  });

  it("reads only the first hop of a multi-proxy forwarded header", () => {
    expect(
      isSecureRequest(
        req("http://localhost:3000/api/respondents", {
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe(true);
    expect(
      isSecureRequest(
        req("http://localhost:3000/api/respondents", {
          "x-forwarded-proto": "http, https",
        }),
      ),
    ).toBe(false);
  });
});

describe("IDENTITY_COOKIE", () => {
  it("has a stable name, since changing it orphans every existing response", () => {
    expect(IDENTITY_COOKIE).toBe("ski_trip_token");
  });
});
