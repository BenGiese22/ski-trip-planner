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
import type { ClientDecline, ClientResponse } from "@/lib/serverSession";
import { useAutosave, type SaveStatus } from "@/hooks/useAutosave";

export type AvailabilityEntry = { date: string; status: AvailabilityStatus };

type ResponseContextValue = {
  response: ClientResponse | null;
  status: SaveStatus;
  lastSavedAt: number | null;
  problems: FinishProblem[];
  /** True once a write has come back 404 — the identity cookie points at a row that's gone. */
  sessionLost: boolean;
  /**
   * True from the moment intake creates the row until the next full page
   * load. Distinguishes "just started" from "returning after a previous
   * visit" — both are `response !== null`, but only the second is a return.
   */
  justCreated: boolean;
  /** Creates the row. Only call once intake is complete — see decision 7. */
  startResponse: (intake: IntakeInput) => Promise<{ ok: boolean; message?: string }>;
  /** Debounced autosave. Pass immediate for selects, toggles and blur. */
  update: (patch: RespondentPatch, options?: { immediate?: boolean }) => void;
  setAvailability: (entries: AvailabilityEntry[]) => void;
  finish: () => Promise<{ ok: boolean; message?: string }>;
};

function isNotFound(err: unknown): boolean {
  return err instanceof Error && (err as { status?: number }).status === 404;
}

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
    // Status travels with the error so callers can single out a 404 (the row
    // is gone) from every other failure, which calls for retrying, not reset.
    throw Object.assign(new Error(message), { status: res.status });
  }

  return res.json();
}

export function ResponseProvider({
  initialResponse,
  initialDecline,
  children,
}: {
  initialResponse: ClientResponse | null;
  initialDecline: ClientDecline | null;
  children: ReactNode;
}) {
  const [response, setResponse] = useState<ClientResponse | null>(initialResponse);
  const [decline, setDecline] = useState<ClientDecline | null>(initialDecline);
  const [problems, setProblems] = useState<FinishProblem[]>([]);
  const [sessionLost, setSessionLost] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  // "Save & finish" doesn't run through the autosave hooks, so its own
  // success needs its own timestamp — otherwise clicking "Update my answer"
  // with nothing changed looks like it did nothing, since lastSavedAt below
  // would still show whenever the last real autosave happened instead.
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  // The row is confirmed gone (stale cookie, merged/deleted server-side) —
  // starting fresh is the right next step here, not a risky one, so this
  // clears state instead of leaving the autosave hooks to retry forever.
  const handleSessionLost = useCallback(() => {
    setResponse(null);
    setProblems([]);
    setSessionLost(true);
  }, []);

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
    try {
      await postJson("/api/respondents", patch, "PATCH");
    } catch (err) {
      if (isNotFound(err)) {
        handleSessionLost();
        return;
      }
      throw err;
    }
  });

  const availability = useAutosave<{ entries: AvailabilityEntry[] }>(async (patch) => {
    try {
      // Merge semantics land exactly right here: `entries` is the whole set, so
      // the newest write wins, which is what replace-all wants.
      await postJson("/api/availability", patch);
    } catch (err) {
      if (isNotFound(err)) {
        handleSessionLost();
        return;
      }
      throw err;
    }
  });

  const startResponse = useCallback(async (intake: IntakeInput) => {
    try {
      const { response: created } = await postJson("/api/respondents", intake);
      setResponse(created);
      setJustCreated(true);
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
    // Await, don't just trigger: the server is about to validate this row for
    // completeness, so every pending write has to have landed first. Firing
    // and hoping loses the race on a slow connection, and the person gets
    // told to fill in answers they already gave.
    try {
      await Promise.all([fields.flush(), availability.flush()]);

      const res = await fetch("/api/respondents/finish", { method: "POST" });
      if (res.status === 422) {
        const body = await res.json();
        setProblems(body.problems ?? []);
        return { ok: false };
      }
      if (!res.ok) {
        const message = await res
          .json()
          .then((body) => body?.error)
          .catch(() => undefined);
        setProblems([]);
        return { ok: false, message: message ?? "Couldn't save & finish — try again." };
      }

      const body = await res.json();
      setResponse(body.response);
      setProblems([]);
      setFinishedAt(Date.now());
      return { ok: true };
    } catch {
      setProblems([]);
      return { ok: false, message: "Couldn't save & finish — try again." };
    }
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
      status,
      lastSavedAt:
        Math.max(fields.lastSavedAt ?? 0, availability.lastSavedAt ?? 0, finishedAt ?? 0) || null,
      problems,
      sessionLost,
      justCreated,
      startResponse,
      update,
      setAvailability,
      finish,
    }),
    [
      response,
      status,
      fields.lastSavedAt,
      availability.lastSavedAt,
      finishedAt,
      problems,
      sessionLost,
      justCreated,
      startResponse,
      update,
      setAvailability,
      finish,
    ],
  );

  return <ResponseContext.Provider value={value}>{children}</ResponseContext.Provider>;
}
