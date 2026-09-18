import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ResponseProvider, useResponse } from "./ResponseProvider";

function wrapper({ children }: { children: ReactNode }) {
  return <ResponseProvider initialResponse={null}>{children}</ResponseProvider>;
}

describe("ResponseProvider startResponse()", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // The intake POST used to always report "check your connection", even for
  // a 429 or 503 whose body already has a precise, guest-facing sentence.
  it("surfaces the server's own error message instead of a generic one", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "That's a lot of changes at once — give it a moment." }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useResponse(), { wrapper });

    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      outcome = await result.current.startResponse({
        name: "Jamie",
        email: "jamie@example.com",
        plusOne: false,
        homeAirport: "SFO",
        skiLevel: "intermediate",
      });
    });

    expect(outcome).toEqual({
      ok: false,
      message: "That's a lot of changes at once — give it a moment.",
    });
  });

  it("falls back to a connection message on an actual network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;

    const { result } = renderHook(() => useResponse(), { wrapper });

    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      outcome = await result.current.startResponse({
        name: "Jamie",
        email: "jamie@example.com",
        plusOne: false,
        homeAirport: "SFO",
        skiLevel: "intermediate",
      });
    });

    expect(outcome?.ok).toBe(false);
    expect(outcome?.message).toMatch(/connection|reach/i);
  });
});

describe("ResponseProvider finish()", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("surfaces the server's own error message on a non-422 failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: "Can't reach the database right now." }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useResponse(), { wrapper });

    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      outcome = await result.current.finish();
    });

    expect(outcome).toEqual({ ok: false, message: "Can't reach the database right now." });
  });

  it("falls back to a generic message when the failure body isn't readable", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useResponse(), { wrapper });

    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      outcome = await result.current.finish();
    });

    expect(outcome?.ok).toBe(false);
    expect(outcome?.message).toBeTruthy();
  });

  // A rejected fetch (offline, DNS failure) must resolve to a message, not
  // reject the promise — a rejection here is what left SaveBar's button
  // stuck on "Saving…" forever, since nothing downstream ever ran.
  it("never rejects — a network failure resolves to a friendly message instead", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { result } = renderHook(() => useResponse(), { wrapper });

    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => {
      outcome = await result.current.finish();
    });

    expect(outcome?.ok).toBe(false);
    expect(outcome?.message).toMatch(/connection|reach/i);
  });
});
