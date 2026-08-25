"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Long enough not to fire on every keystroke, short enough that "saved just
 * now" appears while the person is still looking at the field (section 6).
 */
export const AUTOSAVE_DELAY_MS = 700;

const RETRY_BASE_MS = 1_000;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type Autosave<T extends object> = {
  status: SaveStatus;
  lastSavedAt: number | null;
  /** Debounced. Patches queued inside one window are merged into one request. */
  queue: (patch: Partial<T>) => void;
  /**
   * Immediate — for blur, selects and toggles, and before anything that reads
   * the row back from the server. Resolves once the write has actually landed,
   * so "Save & finish" can await it rather than racing it.
   */
  flush: () => Promise<void>;
};

/**
 * Autosave, per PLAN.md section 6: continuous, silent, and never gated on
 * validation. Nothing depends on the person finding a button first.
 */
export function useAutosave<T extends object>(
  save: (patch: Partial<T>) => Promise<unknown>,
  { maxRetries = 3 }: { maxRetries?: number } = {},
): Autosave<T> {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const pending = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  const mounted = useRef(true);

  // Serialises every save. Two requests writing the same row concurrently
  // could otherwise land out of order, and it's what lets flush await
  // whatever is already in flight rather than starting a second one.
  const chain = useRef<Promise<void>>(Promise.resolve());

  // `save` is typically an inline closure, so it changes identity every
  // render. Holding it in a ref keeps the debounce timer from being torn down
  // and rebuilt on each keystroke, which would stop it ever firing.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  // Lets a retry reschedule without referencing a binding before it exists.
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const doSave = useCallback(async () => {
    if (!mounted.current) return;

    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;

    // Claim the patch before awaiting, so a change made mid-request lands in
    // a fresh object rather than being wiped when this one resolves.
    pending.current = {};
    setStatus("saving");

    try {
      await saveRef.current(patch);
      if (!mounted.current) return;
      attempts.current = 0;
      setStatus("saved");
      setLastSavedAt(Date.now());

      // Anything queued while that was out still needs writing.
      if (Object.keys(pending.current).length > 0) {
        timer.current = setTimeout(() => runRef.current(), AUTOSAVE_DELAY_MS);
      }
    } catch {
      if (!mounted.current) return;
      attempts.current += 1;

      // Put the unsaved fields back, without clobbering anything queued while
      // the request was in flight — those are newer.
      pending.current = { ...patch, ...pending.current };

      if (attempts.current > maxRetries) {
        setStatus("error");
      } else {
        // Quiet retry with backoff. A single blip on flaky wifi shouldn't
        // show the person an error (section 14).
        setStatus("saving");
        timer.current = setTimeout(
          () => runRef.current(),
          RETRY_BASE_MS * 2 ** (attempts.current - 1),
        );
      }
    }
  }, [maxRetries]);

  const run = useCallback((): Promise<void> => {
    chain.current = chain.current.then(doSave, doSave);
    return chain.current;
  }, [doSave]);

  useEffect(() => {
    runRef.current = () => void run();
  }, [run]);

  const queue = useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => runRef.current(), AUTOSAVE_DELAY_MS);
    },
    [],
  );

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    // First pass drains whatever is in flight or already queued; the second
    // picks up a change that arrived behind an in-flight request.
    await run();
    if (Object.keys(pending.current).length > 0) await run();
  }, [run]);

  return { status, lastSavedAt, queue, flush };
}
