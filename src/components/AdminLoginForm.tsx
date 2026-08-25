"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const id = useId();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        setPasscode("");
        // The gate lives in a server component, so re-render it rather than
        // navigating — the new cookie is already set by the time this runs.
        router.refresh();
        return;
      }

      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't sign in just now.");
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-paper border border-line rounded-xl p-5 max-w-[26rem]">
      <label
        className="block font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1.5"
        htmlFor={`${id}-passcode`}
      >
        Passcode
      </label>
      <input
        id={`${id}-passcode`}
        type="password"
        autoComplete="current-password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full border border-line rounded-md px-3 py-2.5 text-sm bg-paper text-ink focus:outline-2 focus:outline-offset-2 focus:outline-pine"
      />

      {/* Live region so the error is announced without moving focus. */}
      <p id={`${id}-error`} role="status" aria-live="polite" className="text-xs text-rust mt-1.5 min-h-[1rem]">
        {error ?? ""}
      </p>

      <button
        type="submit"
        disabled={submitting || passcode.length === 0}
        className="mt-2 text-sm text-paper bg-pine px-4 py-2.5 rounded-md hover:bg-pine-dark disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-pine"
      >
        {submitting ? "Checking…" : "Show me the responses →"}
      </button>
    </form>
  );
}
