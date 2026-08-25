"use client";

import { useId, useState, type FormEvent } from "react";
import { airports } from "@/data/airports";
import { intakeSchema, type IntakeInput } from "@/lib/schemas";
import { useResponse } from "./ResponseProvider";

const SKI_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const fieldClasses =
  "w-full border border-line rounded-md px-3 py-2.5 text-sm bg-paper text-ink " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-pine";

const labelClasses = "block font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1.5";

type Draft = {
  name: string;
  email: string;
  plusOne: string;
  homeAirport: string;
  skiLevel: string;
};

function draftFrom(response: ReturnType<typeof useResponse>["response"]): Draft {
  return {
    name: response?.name ?? "",
    email: response?.email ?? "",
    plusOne: response ? String(response.plusOne) : "false",
    homeAirport: response?.homeAirport ?? "",
    skiLevel: response?.skiLevel ?? "",
  };
}

function parseDraft(draft: Draft) {
  return intakeSchema.safeParse({
    name: draft.name,
    email: draft.email,
    plusOne: draft.plusOne === "true",
    homeAirport: draft.homeAirport,
    skiLevel: draft.skiLevel,
  } satisfies Record<keyof IntakeInput, unknown>);
}

export function IntakeForm() {
  const { response, startResponse, update } = useResponse();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(response));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const ids = useId();

  const started = response !== null;

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));

    // Once the row exists every edit autosaves. Before that there's nothing to
    // save to yet — decision 7 defers row creation until intake is complete.
    if (!started) return;
    const parsed = parseDraft({ ...draft, [key]: value });
    if (parsed.success) update(parsed.data, { immediate: true });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseDraft(draft);

    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      return;
    }

    setErrors({});
    setSubmitting(true);
    setFormError(null);
    const result = await startResponse(parsed.data);
    setSubmitting(false);
    if (!result.ok) setFormError(result.message ?? "Something went wrong.");
  }

  const describedBy = (field: string) =>
    errors[field] ? `${ids}-${field}-error` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={labelClasses} htmlFor={`${ids}-name`}>
            Your name
          </label>
          <input
            id={`${ids}-name`}
            className={fieldClasses}
            type="text"
            value={draft.name}
            placeholder="Jamie Rivera"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name")}
            onChange={(e) => set("name", e.target.value)}
          />
          <FieldError id={`${ids}-name-error`} message={errors.name} />
        </div>

        <div>
          <label className={labelClasses} htmlFor={`${ids}-email`}>
            Email
          </label>
          <input
            id={`${ids}-email`}
            className={fieldClasses}
            type="email"
            value={draft.email}
            placeholder="jamie@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email")}
            onChange={(e) => set("email", e.target.value)}
          />
          <FieldError id={`${ids}-email-error`} message={errors.email} />
        </div>

        <div>
          <label className={labelClasses} htmlFor={`${ids}-plusOne`}>
            Coming solo or with someone?
          </label>
          <select
            id={`${ids}-plusOne`}
            className={fieldClasses}
            value={draft.plusOne}
            onChange={(e) => set("plusOne", e.target.value)}
          >
            <option value="false">Just me</option>
            <option value="true">Me plus a partner</option>
          </select>
        </div>

        <div>
          <label className={labelClasses} htmlFor={`${ids}-airport`}>
            Home airport
          </label>
          <select
            id={`${ids}-airport`}
            className={fieldClasses}
            value={draft.homeAirport}
            aria-invalid={Boolean(errors.homeAirport)}
            aria-describedby={describedBy("homeAirport")}
            onChange={(e) => set("homeAirport", e.target.value)}
          >
            <option value="">Pick one</option>
            {airports.map((airport) => (
              <option key={airport.code} value={airport.code}>
                {airport.code} — {airport.city}
              </option>
            ))}
          </select>
          <FieldError id={`${ids}-homeAirport-error`} message={errors.homeAirport} />
        </div>

        <div>
          <label className={labelClasses} htmlFor={`${ids}-skiLevel`}>
            How comfortable are you on snow?
          </label>
          <select
            id={`${ids}-skiLevel`}
            className={fieldClasses}
            value={draft.skiLevel}
            aria-invalid={Boolean(errors.skiLevel)}
            aria-describedby={describedBy("skiLevel")}
            onChange={(e) => set("skiLevel", e.target.value)}
          >
            <option value="">Pick one</option>
            {SKI_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
          <FieldError id={`${ids}-skiLevel-error`} message={errors.skiLevel} />
        </div>
      </div>

      {!started && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={submitting}
            className="text-sm text-paper bg-pine px-4 py-2.5 rounded-md hover:bg-pine-dark disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-pine"
          >
            {submitting ? "Saving…" : "Start my response →"}
          </button>
          <p className="text-xs text-ink-soft max-w-[46ch]">
            Nothing is saved until you start — after that every answer on this
            page saves itself as you go.
          </p>
        </div>
      )}

      {formError && (
        <p role="alert" className="text-sm text-rust mt-3">
          {formError}
        </p>
      )}
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-rust mt-1">
      {message}
    </p>
  );
}
