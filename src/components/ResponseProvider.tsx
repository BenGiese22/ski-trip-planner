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
  status: SaveStatus;
  lastSavedAt: number | null;
  problems: FinishProblem[];
  /** Creates the row. Only call once intake is complete — see decision 7. */
  startResponse: (intake: IntakeInput) => Promise<{ ok: boolean; message?: string }>;
  /** Debounced autosave. Pass immediate for selects, toggles and blur. */
  update: (patch: RespondentPatch, options?: { immediate?: boolean }) => void;
  setAvailability: (entries: AvailabilityEntry[]) => void;
  finish: () => Promise<{ ok: boolean }>;
};

const ResponseContext = createContext<ResponseContextValue | null>(null);

export function useResponse(): ResponseContextValue {
  const value = useContext(ResponseContext);
  if (!value) throw new Error("useResponse must be used inside a ResponseProvider");
  return value;
}

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed with ${res.status}`);
  return res.json();
}

export function ResponseProvider({
  initialResponse,
  children,
}: {
  initialResponse: ClientResponse | null;
  children: ReactNode;
}) {
  const [response, setResponse] = useState<ClientResponse | null>(initialResponse);
  const [problems, setProblems] = useState<FinishProblem[]>([]);

  const fields = useAutosave<RespondentPatch>(async (patch) => {
    const { response: saved } = await postJson("/api/respondents", patch, "PATCH");
    setResponse(saved);
  });

  const availability = useAutosave<{ entries: AvailabilityEntry[] }>(async (patch) => {
    // Merge semantics land exactly right here: `entries` is the whole set, so
    // the newest write wins, which is what replace-all wants.
    const { response: saved } = await postJson("/api/availability", patch);
    setResponse(saved);
  });

  const startResponse = useCallback(async (intake: IntakeInput) => {
    try {
      const { response: created } = await postJson("/api/respondents", intake);
      setResponse(created);
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "Couldn't save that just now — check your connection and try again.",
      };
    }
  }, []);

  const update = useCallback(
    (patch: RespondentPatch, { immediate = false }: { immediate?: boolean } = {}) => {
      // Reflect the change straight away so the cost table and grid don't wait
      // on a round trip to redraw.
      setResponse((current) => (current ? { ...current, ...patch } : current));
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
    await Promise.all([fields.flush(), availability.flush()]);

    const res = await fetch("/api/respondents/finish", { method: "POST" });
    if (res.status === 422) {
      const body = await res.json();
      setProblems(body.problems ?? []);
      return { ok: false };
    }
    if (!res.ok) return { ok: false };

    const body = await res.json();
    setResponse(body.response);
    setProblems([]);
    return { ok: true };
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
      lastSavedAt: Math.max(fields.lastSavedAt ?? 0, availability.lastSavedAt ?? 0) || null,
      problems,
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
      problems,
      startResponse,
      update,
      setAvailability,
      finish,
    ],
  );

  return <ResponseContext.Provider value={value}>{children}</ResponseContext.Provider>;
}
