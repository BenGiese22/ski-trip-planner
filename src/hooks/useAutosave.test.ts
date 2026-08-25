import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, useAutosave } from "./useAutosave";

type Patch = { skiDays?: number; gearStatus?: string; notes?: string };

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const flushMicrotasks = () => act(async () => undefined);

  it("does not save before the debounce window elapses", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it("saves once the window elapses", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await flushMicrotasks();

    expect(save).toHaveBeenCalledExactlyOnceWith({ notes: "a" });
  });

  // Typing in one field then changing a dropdown shouldn't produce two
  // requests racing each other to write the same row.
  it("merges everything queued within the window into a single save", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.queue({ skiDays: 3 }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.queue({ notes: "ab" }));
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await flushMicrotasks();

    expect(save).toHaveBeenCalledExactlyOnceWith({ notes: "ab", skiDays: 3 });
  });

  it("flushes immediately, for blur and select changes", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ gearStatus: "own" }));
    act(() => result.current.flush());
    await flushMicrotasks();

    expect(save).toHaveBeenCalledExactlyOnceWith({ gearStatus: "own" });
  });

  it("does nothing on flush when there's nothing pending", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.flush());
    await flushMicrotasks();

    expect(save).not.toHaveBeenCalled();
  });

  it("reports saving, then saved", async () => {
    let resolve!: () => void;
    const save = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    const { result } = renderHook(() => useAutosave<Patch>(save));

    expect(result.current.status).toBe("idle");

    act(() => result.current.queue({ notes: "a" }));
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
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
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.queue({ notes: "second" }));
    await act(async () => {
      resolveFirst();
    });
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
    });
    await flushMicrotasks();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ notes: "second" });
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });

    expect(result.current.status).not.toBe("error");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.status).toBe("saved");
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces an error once the retries are exhausted", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAutosave<Patch>(save, { maxRetries: 2 }));

    act(() => result.current.queue({ notes: "a" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.status).toBe("error");
  });

  it("recovers to saved when a later attempt succeeds after an error", async () => {
    const save = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAutosave<Patch>(save, { maxRetries: 1 }));

    act(() => result.current.queue({ notes: "a" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.status).toBe("error");

    save.mockResolvedValue(undefined);
    act(() => result.current.queue({ notes: "b" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });

    expect(result.current.status).toBe("saved");
  });

  it("does not fire a pending save after unmount", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useAutosave<Patch>(save));

    act(() => result.current.queue({ notes: "a" }));
    unmount();
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 4);
    });
    await flushMicrotasks();

    expect(save).not.toHaveBeenCalled();
  });
});
