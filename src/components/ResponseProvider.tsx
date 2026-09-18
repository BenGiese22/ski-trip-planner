"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AvailabilityStatus } from "@/db/schema";
import type { FinishProblem } from "@/lib/finish";
import type { IntakeInput, RespondentPatch } from "@/lib/schemas";
import type { ClientResponse } from "@/lib/serverSession";
import { useAutosave, type SaveStatus } from "@/hooks/useAutosave";

export type AvailabilityEntry = { date: string; status: AvailabilityStatus };

type ResponseContextValue = {
  response: ClientResponse | null;
  /** True when the server-side load threw (e.g. the database is unreachable),
   * as opposed to a genuine first-time visitor with no saved response. */
  loadFailed: boolean;
  status: SaveStatus;
  lastSavedAt: number | null;
  problems: FinishProblem[];
  /** Creates the row. Only call once intake is complete — see decision 7. */
  startResponse: (intake: IntakeInput) => Promise<{ ok: boolean; message?: string }>;
  /** Debounced autosave. Pass immediate for selects, toggles and blur. */
  update: (patch: RespondentPatch, options?: { immediate?: boolean }) => void;
  setAvailability: (entries: AvailabilityEntry[]) => void;
  finish: () => Promise<{ ok: boolean; message?: string }>;
  /** Manual "Retry" — flushes whichever saver(s) are sitting in error. */
  retry: () => void;
};

const ResponseContext = createContext<ResponseContextValue | null>(null);

export function useResponse(): ResponseContextValue {
  const value = useContext(ResponseContext);
  if (!value) throw new Error("useResponse must be used inside a ResponseProvider");
  return value;
}

async function postJson(url: string, body: unknown, method = "POST") {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server — check your connection and try again.");
  }

  if (!res.ok) {
    // The API's own error bodies are already written for a guest to read
    // (rate limit, no-such-respondent, DB unreachable) — prefer them over a
    // generic status-code message when they're there.
    let message = `${method} ${url} failed with ${res.status}`;
    try {
      const errorBody = await res.json();
      if (typeof errorBody?.error === "string") message = errorBody.error;
    } catch {
      // Non-JSON error body (a raw 500, say) — the generic message stands.
    }
    throw new Error(message);
  }

  return res.json();
}

export function ResponseProvider({
  initialResponse,
  loadFailed = false,
  children,
}: {
  initialResponse: ClientResponse | null;
  loadFailed?: boolean;
  children: ReactNode;
}) {
  const [response, setResponse] = useState<ClientResponse | null>(initialResponse);
  const [problems, setProblems] = useState<FinishProblem[]>([]);

  /**
   * Autosave responses are deliberately *not* written back into state. The
   * optimistic update already applied the change, and the reply describes the
   * row as it was when that request was handled — so a second edit made while
   * the first was in flight would be silently reverted by the first reply.
   * Ranking two positions in quick succession reproduced exactly that.
   *
   * The server is still the source of truth on load, and after "Save &
   * finish", which is where its reply is applied.
   */
  const fields = useAutosave<RespondentPatch>(async (patch) => {
    await postJson("/api/respondents", patch, "PATCH");
  });

  const availability = useAutosave<{ entries: AvailabilityEntry[] }>(async (patch) => {
    // Merge semantics land exactly right here: `entries` is the whole set, so
    // the newest write wins, which is what replace-all wants.
    await postJson("/api/availability", patch);
  });

  const startResponse = useCallback(async (intake: IntakeInput) => {
    try {
      const { response: created } = await postJson("/api/respondents", intake);
      setResponse(created);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Couldn't save that just now — check your connection and try again.",
      };
    }
  }, []);

  const update = useCallback(
    (patch: RespondentPatch, { immediate = false }: { immediate?: boolean } = {}) => {
      // Reflect the change straight away so the cost table and grid don't wait
      // on a round trip to redraw. A null ranking means "cleared", which the
      // client shape represents as an empty array rather than null.
      setResponse((current) => {
        if (!current) return current;
        const { destinationRanking, ...columns } = patch;
        return {
          ...current,
          ...columns,
          ...(destinationRanking !== undefined
            ? { destinationRanking: destinationRanking ?? [] }
            : {}),
        };
      });
      fields.queue(patch);
      if (immediate) void fields.flush();
    },
    [fields],
  );

  const setAvailability = useCallback(
    (entries: AvailabilityEntry[]) => {
      setResponse((current) => (current ? { ...current, availability: entries } : current));
      availability.queue({ entries });
      void availability.flush();
    },
    [availability],
  );

  const finish = useCallback(async () => {
    try {
      // Await, don't just trigger: the server is about to validate this row
      // for completeness, so every pending write has to have landed first.
      // Firing and hoping loses the race on a slow connection, and the person
      // gets told to fill in answers they already gave.
      await Promise.all([fields.flush(), availability.flush()]);

      const res = await fetch("/api/respondents/finish", { method: "POST" });
      if (res.status === 422) {
        const body = await res.json();
        setProblems(body.problems ?? []);
        return { ok: false };
      }
      if (!res.ok) {
        // The API's own error bodies are already written for a guest to
        // read (rate limit, no-such-respondent, DB unreachable) — prefer
        // them over a generic message when they're there.
        let message = "Couldn't save that just now — try again in a moment.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          // Non-JSON error body (a raw 500, say) — the generic message stands.
        }
        return { ok: false, message };
      }

      const body = await res.json();
      setResponse(body.response);
      setProblems([]);
      return { ok: true };
    } catch {
      // A thrown fetch (offline, DNS failure) must still resolve — a
      // rejected promise here left the "Save & finish" button stuck on
      // "Saving…" forever, since nothing downstream ever ran.
      return {
        ok: false,
        message: "Couldn't reach the server — check your connection and try again.",
      };
    }
  }, [fields, availability]);

  const retry = useCallback(() => {
    void fields.flush();
    void availability.flush();
  }, [fields, availability]);

  // One indicator for two savers: an error anywhere is an error, and a save
  // anywhere in flight reads as saving.
  const status: SaveStatus = useMemo(() => {
    const both = [fields.status, availability.status];
    if (both.includes("error")) return "error";
    if (both.includes("saving")) return "saving";
    if (both.includes("saved")) return "saved";
    return "idle";
  }, [fields.status, availability.status]);

  const value = useMemo<ResponseContextValue>(
    () => ({
      response,
      loadFailed,
      status,
      lastSavedAt: Math.max(fields.lastSavedAt ?? 0, availability.lastSavedAt ?? 0) || null,
      problems,
      startResponse,
      update,
      setAvailability,
      finish,
      retry,
    }),
    [
      response,
      loadFailed,
      status,
      fields.lastSavedAt,
      availability.lastSavedAt,
      problems,
      startResponse,
      update,
      setAvailability,
      finish,
      retry,
    ],
  );

  return <ResponseContext.Provider value={value}>{children}</ResponseContext.Provider>;
}
