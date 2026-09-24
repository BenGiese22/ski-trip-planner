"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AvailabilityStatus } from "@/db/schema";
import type { FinishProblem } from "@/lib/finish";
import type { DeclineInput, DeclineReasonInput, IntakeInput, RespondentPatch } from "@/lib/schemas";
import type { ClientDecline, ClientResponse } from "@/lib/serverSession";
import { SessionLostError, useAutosave, type SaveStatus } from "@/hooks/useAutosave";

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
  decline: ClientDecline | null;
  /** True after "Actually, I can make it" on a decline-only visit — reveals
   * IntakeForm client-side, writes nothing until intake is actually completed. */
  reconsidering: boolean;
  /** A decline is on file and there's no respondent row to go with it — the
   * `DeclinedPanel` (not `IntakeForm`) owns this slot until that changes. */
  declinedOnly: boolean;
  reconsider: () => void;
  declineTrip: (body: DeclineInput | DeclineReasonInput) => Promise<{ ok: boolean; message?: string }>;
  undoDecline: () => Promise<{ ok: boolean; message?: string }>;
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

const UNSAVED_EDITS_MESSAGE =
  "Your latest answers haven't saved yet — check your connection and try again.";

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
  const [reconsidering, setReconsidering] = useState(false);
  // "Save & finish" doesn't run through the autosave hooks, so its own
  // success needs its own timestamp — otherwise clicking "Update my answer"
  // with nothing changed looks like it did nothing, since lastSavedAt below
  // would still show whenever the last real autosave happened instead.
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  // The save callbacks below need handleSessionLost, which needs both hooks'
  // reset() — a ref breaks the cycle. Synced in an effect once both exist.
  const onLostRef = useRef<() => void>(() => {});

  /**
   * Autosave responses are deliberately *not* written back into state. The
   * optimistic update already applied the change, and the reply describes the
   * row as it was when that request was handled — so a second edit made while
   * the first was in flight would be silently reverted by the first reply.
   * Ranking two positions in quick succession reproduced exactly that.
   *
   * The server is still the source of truth on load. "Save & finish" takes
   * only `submittedAt` from its reply, for the same reason: an edit made while
   * /finish was in flight is newer than the snapshot it returns.
   */
  const fields = useAutosave<RespondentPatch>(async (patch) => {
    try {
      await postJson("/api/respondents", patch, "PATCH");
    } catch (err) {
      if (isNotFound(err)) {
        onLostRef.current();
        // Not a save: the hook drops the patch rather than marking it saved.
        throw new SessionLostError();
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
        onLostRef.current();
        // Not a save: the hook drops the patch rather than marking it saved.
        throw new SessionLostError();
      }
      throw err;
    }
  });

  const { reset: resetFields } = fields;
  const { reset: resetAvailability } = availability;

  // The row is confirmed gone (stale cookie, merged/deleted server-side) —
  // starting fresh is the right next step here, not a risky one, so this
  // clears state instead of leaving the autosave hooks to retry forever. Both
  // hooks are reset too: a write queued under the old cookie would only 404.
  const handleSessionLost = useCallback(() => {
    resetFields();
    resetAvailability();
    setResponse(null);
    setDecline(null);
    setProblems([]);
    setSessionLost(true);
  }, [resetFields, resetAvailability]);

  useEffect(() => {
    onLostRef.current = handleSessionLost;
  }, [handleSessionLost]);

  const startResponse = useCallback(async (intake: IntakeInput) => {
    try {
      const { response: created } = await postJson("/api/respondents", intake);
      setResponse(created);
      setJustCreated(true);
      setDecline(null);
      setReconsidering(false);
      // A fresh row answers the "start fresh below" notice.
      setSessionLost(false);
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

  const reconsider = useCallback(() => setReconsidering(true), []);

  const declineTrip = useCallback(async (body: DeclineInput | DeclineReasonInput) => {
    try {
      const { decline: updated } = await postJson("/api/declines", body);
      setDecline(updated);
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

  const undoDecline = useCallback(async () => {
    try {
      await postJson("/api/declines", undefined, "DELETE");
      setDecline(null);
      return { ok: true };
    } catch (err) {
      // A 404 here means "no decline on file for this browser" — already
      // undone, e.g. by a second tab. That's success, not an error to dismiss.
      if (isNotFound(err)) {
        setDecline(null);
        return { ok: true };
      }
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Couldn't undo that just now — check your connection and try again.",
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
      const landed = await Promise.all([fields.flush(), availability.flush()]);
      // An edit that hasn't reached the server would be validated (and
      // submitted) without it. The background retries carry on; the person
      // can press the button again once their connection is back.
      if (landed.includes(false)) {
        setProblems([]);
        return { ok: false, message: UNSAVED_EDITS_MESSAGE };
      }

      const res = await fetch("/api/respondents/finish", { method: "POST" });
      if (res.status === 422) {
        const body = await res.json();
        setProblems(body.problems ?? []);
        return { ok: false };
      }
      if (res.status === 404) {
        // The row is gone. SessionLostNotice is the message; returning one
        // here too would leave SaveBar showing stale copy after re-intake.
        handleSessionLost();
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
      // Only submittedAt comes from the reply: an edit made while this request
      // was out is already in state and would be reverted by the snapshot.
      setResponse((current) =>
        current ? { ...current, submittedAt: body.response.submittedAt } : body.response,
      );
      // The server cleared any decline in the same transaction (§19.10).
      setDecline(null);
      setProblems([]);
      setFinishedAt(Date.now());
      return { ok: true };
    } catch {
      setProblems([]);
      return { ok: false, message: "Couldn't save & finish — try again." };
    }
  }, [fields, availability, handleSessionLost]);

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
      decline,
      reconsidering,
      declinedOnly: decline !== null && response === null && !reconsidering,
      reconsider,
      declineTrip,
      undoDecline,
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
      decline,
      reconsidering,
      reconsider,
      declineTrip,
      undoDecline,
      startResponse,
      update,
      setAvailability,
      finish,
    ],
  );

  return <ResponseContext.Provider value={value}>{children}</ResponseContext.Provider>;
}
