"use client";

import { useState } from "react";
import type { ClientDecline, ClientResponse } from "@/lib/serverSession";
import { firstNameOf, primaryButtonClasses } from "./formPrimitives";
import { useResponse } from "./ResponseProvider";

/**
 * What a guest who bowed out sees on their way back in — the mirror of
 * `WelcomeBack`, and deliberately the same card, since "we know who you are"
 * is the same message either way. Two variants: decline-only (entry point A,
 * no respondent row) and both-rows (entry point B, a respondent row exists
 * underneath and "un-declining" is a real request rather than a reveal).
 */
export function DeclinedPanel() {
  const { response, decline, reconsidering, reconsider } = useResponse();
  if (!decline) return null;
  if (response) return <BothRowsPanel decline={decline} response={response} />;
  if (reconsidering) return null;

  const firstName = decline.name ? firstNameOf(decline.name) : undefined;

  return (
    <div className="bg-green-tint border border-[#BFD9C4] rounded-xl p-5 mb-3.5">
      <h3 className="font-serif font-bold text-lg">
        {firstName ? `Thanks for letting Ben know, ${firstName}.` : "Thanks for letting Ben know."}
      </h3>
      <p className="text-sm text-ink-soft mt-1.5">
        You said you can&rsquo;t make it this time. If that changes, you can
        still fill in a response — nothing&rsquo;s locked.
      </p>
      <button type="button" onClick={reconsider} className={`${primaryButtonClasses} mt-3.5`}>
        Actually, I can make it
      </button>
    </div>
  );
}

/**
 * Entry point B: the respondent row is still there, so "un-declining" just
 * clears the decline row instead of revealing a form to fill back in.
 */
function BothRowsPanel({
  decline,
  response,
}: {
  decline: ClientDecline;
  response: ClientResponse;
}) {
  const { undoDecline } = useResponse();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = firstNameOf(decline.name ?? response.name);

  async function onUndo() {
    setSubmitting(true);
    setError(null);
    const result = await undoDecline();
    setSubmitting(false);
    if (!result.ok) setError(result.message ?? "Something went wrong.");
  }

  return (
    <div className="bg-green-tint border border-[#BFD9C4] rounded-xl p-5 mb-3.5">
      <h3 className="font-serif font-bold text-lg">Thanks for letting Ben know, {firstName}.</h3>
      <p className="text-sm text-ink-soft mt-1.5">
        You&rsquo;ve said you can&rsquo;t make it after all. Everything
        you&rsquo;d filled in is still here and nothing&rsquo;s locked — if
        plans change, one click puts you back in.
      </p>
      <button
        type="button"
        onClick={onUndo}
        disabled={submitting}
        className={`${primaryButtonClasses} mt-3.5`}
      >
        {submitting ? "Saving…" : "Actually, I can make it"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-rust mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
