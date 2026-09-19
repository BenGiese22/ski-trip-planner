"use client";

import { useId, useState, type FormEvent } from "react";
import { DECLINE_REASON_MAX, declineReasonSchema, declineSchema } from "@/lib/schemas";
import { FieldError, fieldClasses, labelClasses, primaryButtonClasses } from "./formPrimitives";
import { useResponse } from "./ResponseProvider";

const focusRing = "focus:outline-2 focus:outline-offset-2 focus:outline-pine";

/**
 * Names the field group for assistive tech. "Your name" labels a field in the
 * intake form right below, so the group is the only thing telling them apart
 * — the e2e suite scopes on it too.
 */
const DECLINE_FORM_LABEL = "Can't make it";

// Deliberately a quiet text link rather than a button: bowing out is a real
// option, but it shouldn't compete with starting a response. `py-1 min-h-6`
// keeps it over the 24x24 tap-target floor all the same — it isn't inside a
// paragraph, so WCAG's inline-text exception doesn't cover it.
const triggerClasses =
  `text-sm text-ink-soft underline underline-offset-2 hover:text-ink py-1 min-h-6 ${focusRing}`;

const quietButtonClasses = `text-sm text-ink-soft hover:text-ink px-2 py-2.5 ${focusRing}`;

/**
 * Lets a guest bow out — entry point A if they haven't started a response
 * yet (collects name/email/reason), entry point B if they have (name and
 * email are already on file, so only the reason is asked). Hidden once a
 * decline is on file — `DeclinedPanel` owns that slot.
 */
export function CantMakeIt() {
  const { response, decline } = useResponse();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (decline) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={() => setExpanded((open) => !open)}
        className={triggerClasses}
      >
        {response
          ? "Can’t make it after all? Let Ben know"
          : "Can’t make it this time? Let Ben know"}
      </button>

      {expanded && (
        <div id={panelId} className="mt-3">
          <DeclineForm mode={response ? "existing" : "new"} onCancel={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
}

type Draft = { name: string; email: string; reason: string };

function parseDraft(draft: Draft) {
  // Blank optionals are left out of the body entirely rather than sent as
  // "" — the column is nullable, and an empty string reads as an answer.
  return declineSchema.safeParse({
    name: draft.name,
    ...(draft.email.trim() ? { email: draft.email } : {}),
    ...(draft.reason.trim() ? { reason: draft.reason } : {}),
  });
}

/**
 * One form, two modes: `new` is entry point A (no respondent row, so
 * name/email/reason are all asked); `existing` is entry point B (name and
 * email are already on file, so only the reason is asked).
 */
function DeclineForm({ mode, onCancel }: { mode: "new" | "existing"; onCancel: () => void }) {
  const { declineTrip } = useResponse();
  const [draft, setDraft] = useState<Draft>({ name: "", email: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const ids = useId();

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed =
      mode === "new"
        ? parseDraft(draft)
        : declineReasonSchema.safeParse(draft.reason.trim() ? { reason: draft.reason } : {});

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
    const result = await declineTrip(parsed.data);
    setSubmitting(false);
    if (!result.ok) setFormError(result.message ?? "Something went wrong.");
  }

  const describedBy = (field: string) =>
    errors[field] ? `${ids}-${field}-error` : undefined;

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset>
        <legend className="sr-only">{DECLINE_FORM_LABEL}</legend>

        {mode === "new" && (
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
                Email (optional)
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
          </div>
        )}

        <div className={mode === "new" ? "mt-3.5" : undefined}>
          <label className={labelClasses} htmlFor={`${ids}-reason`}>
            Anything you want Ben to know? (optional)
          </label>
          <textarea
            id={`${ids}-reason`}
            className={fieldClasses}
            rows={3}
            maxLength={DECLINE_REASON_MAX}
            value={draft.reason}
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={[`${ids}-reason-count`, describedBy("reason")]
              .filter(Boolean)
              .join(" ")}
            onChange={(e) => set("reason", e.target.value)}
          />
          <p id={`${ids}-reason-count`} className="text-xs text-ink-soft mt-1">
            {draft.reason.length}/{DECLINE_REASON_MAX}
          </p>
          <FieldError id={`${ids}-reason-error`} message={errors.reason} />
          {mode === "existing" && (
            <p className="text-xs text-ink-soft mt-1.5">
              Ben already has your name and email. Everything you&rsquo;ve
              filled in stays put — you can change your mind any time.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button type="submit" disabled={submitting} className={primaryButtonClasses}>
            {submitting ? "Saving…" : "Let Ben know"}
          </button>
          <button type="button" onClick={onCancel} className={quietButtonClasses}>
            Never mind
          </button>
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="text-sm text-rust mt-3">
          {formError}
        </p>
      )}
    </form>
  );
}
