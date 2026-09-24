import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, SessionLostError, useAutosave } from "./useAutosave";

type Patch = { skiDays?: number; gearStatus?: string; notes?: string };

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Saves are serialised through a promise chain, so starting one costs a
   * microtask hop. advanceTimersByTimeAsync drives the timers and flushes that
   * chain; plain advanceTimersByTime would assert before the save has begun.
   */
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("does not save before the debounce window elapses", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS - 1);

    expect(save).not.toHaveBeenCalled();
  });

  it("saves once the window elapses", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(save).toHaveBeenCalledExactlyOnceWith({ notes: "a" });
  });

  // Typing in one field then changing a dropdown shouldn't produce two
  // requests racing each other to write the same row.
  it("merges everything queued within the window into a single save", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    await advance(200);
    act(() => result.current.queue({ skiDays: 3 }));
    await advance(200);
    act(() => result.current.queue({ notes: "ab" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(save).toHaveBeenCalledExactlyOnceWith({ notes: "ab", skiDays: 3 });
  });

  it("flushes immediately, for blur and select changes", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ gearStatus: "own" }));
    await act(async () => {
      await result.current.flush();
    });

    expect(save).toHaveBeenCalledExactlyOnceWith({ gearStatus: "own" });
  });

  it("does nothing on flush when there's nothing pending", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    await act(async () => {
      await result.current.flush();
    });

    expect(save).not.toHaveBeenCalled();
  });

  it("reports saving, then saved", async () => {
    let resolve!: () => void;
    const save = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const { result } = renderHook(() => useAutosave<Patch>(save));

    expect(result.current.status).toBe("idle");

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(result.current.status).toBe("saving");

    await act(async () => {
      resolve();
    });
    expect(result.current.status).toBe("saved");
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  // A change made while a request is in flight must not be dropped — that's
  // the failure mode where someone's last answer silently never persists.
  it("keeps a change queued during an in-flight save", async () => {
    let resolveFirst!: () => void;
    const save = vi
      .fn()
      .mockReturnValueOnce(new Promise<void>((r) => (resolveFirst = r)))
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "first" }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.queue({ notes: "second" }));
    await act(async () => {
      resolveFirst();
    });
    await advance(AUTOSAVE_DELAY_MS);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ notes: "second" });
  });

  /**
   * "Save & finish" flushes and then immediately asks the server to validate
   * the row. If flush resolves before the PATCH lands, the server checks a row
   * that hasn't been written yet and rejects a response that is actually
   * complete — exactly what the mobile e2e run caught.
   */
  it("resolves flush only once the save has actually landed", async () => {
    let resolveSave!: () => void;
    const save = vi.fn().mockReturnValue(new Promise<void>((r) => (resolveSave = r)));
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ skiDays: 2 }));

    let flushed = false;
    await act(async () => {
      void result.current.flush().then(() => {
        flushed = true;
      });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(flushed).toBe(false);

    await act(async () => {
      resolveSave();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(flushed).toBe(true);
  });

  it("flush waits for an in-flight save and the change queued behind it", async () => {
    const resolvers: (() => void)[] = [];
    const save = vi.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolvers.push(r);
        }),
    );
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ skiDays: 2 }));
    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    // A second change arrives while the first request is still out.
    act(() => result.current.queue({ gearStatus: "rental" }));

    let flushed = false;
    await act(async () => {
      void result.current.flush().then(() => {
        flushed = true;
      });
      resolvers[0]();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(flushed).toBe(false);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ gearStatus: "rental" });

    await act(async () => {
      resolvers[1]();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(flushed).toBe(true);
  });

  // "Save & finish" must not ask the server to validate a row whose latest
  // edit never landed — flush has to say so rather than resolve regardless.
  it("resolves flush to false when the save keeps failing", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ skiDays: 2 }));

    let landed: boolean | undefined;
    await act(async () => {
      landed = await result.current.flush();
    });

    expect(landed).toBe(false);
  });

  it("resolves flush to true once a retried save lands", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ skiDays: 2 }));

    let landed: boolean | undefined;
    await act(async () => {
      landed = await result.current.flush();
    });

    expect(landed).toBe(true);
  });

  // Section 14: retry quietly, and only surface an indicator if it keeps
  // failing. A single dropped request on flaky wifi shouldn't alarm anyone.
  it("retries a failed save without reporting an error", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(result.current.status).not.toBe("error");

    await advance(5_000);

    expect(result.current.status).toBe("saved");
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces an error once the retries are exhausted", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAutosave<Patch>(save, { maxRetries: 2 }));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);
    await advance(30_000);

    expect(result.current.status).toBe("error");
  });

  it("recovers to saved when a later attempt succeeds after an error", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAutosave<Patch>(save, { maxRetries: 1 }));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);
    await advance(30_000);
    expect(result.current.status).toBe("error");

    save.mockResolvedValue(undefined);
    act(() => result.current.queue({ notes: "b" }));
    await advance(AUTOSAVE_DELAY_MS);

    expect(result.current.status).toBe("saved");
  });

  // A fresh edit is a fresh signal: it shouldn't inherit an exhausted retry
  // count from whatever failed before it. Without the fix, this edit's first
  // failure would immediately re-trip "error" instead of retrying and saving.
  it("gives a fresh edit its own retry budget after a prior error", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAutosave<Patch>(save, { maxRetries: 1 }));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);
    await advance(30_000);
    expect(result.current.status).toBe("error");

    save.mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined);
    act(() => result.current.queue({ notes: "b" }));
    await advance(AUTOSAVE_DELAY_MS);
    await advance(30_000);

    expect(result.current.status).toBe("saved");
  });

  // A 404 means the row is gone: retrying can only 404 again, and the change
  // didn't land, so it mustn't read as "Saved" either.
  it("treats SessionLostError as terminal: drops the patch, no retry, not saved", async () => {
    const save = vi.fn().mockRejectedValue(new SessionLostError());
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    await advance(AUTOSAVE_DELAY_MS);
    await advance(30_000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
    expect(result.current.lastSavedAt).toBeNull();
  });

  it("reset() drops queued patches and returns to idle", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    act(() => result.current.reset());
    await advance(AUTOSAVE_DELAY_MS * 4);

    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.lastSavedAt).toBeNull();
  });

  it("does not fire a pending save after unmount", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    unmount();
    await advance(AUTOSAVE_DELAY_MS * 4);

    expect(save).not.toHaveBeenCalled();
  });
});
