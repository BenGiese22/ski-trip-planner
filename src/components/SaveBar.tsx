"use client";

import { useEffect, useState } from "react";
import { useResponse } from "./ResponseProvider";

const STATUS_COPY = {
  idle: "Every answer saves itself as you go",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save — we'll keep trying",
} as const;

function agoLabel(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
}

/**
 * Visible throughout rather than only at the end — someone might reasonably
 * decide they're done after the destination and dates, without scrolling
 * through the cost calculator (PLAN.md section 6).
 */
export function SaveBar() {
  const { response, status, lastSavedAt, problems, finish } = useResponse();
  const [finishing, setFinishing] = useState(false);
  const [, forceTick] = useState(0);

  // Keeps "saved just now" from going stale while the page sits open.
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  if (!response) return null;

  const submitted = Boolean(response.submittedAt);

  return (
    <div className="sticky bottom-0 z-20 bg-pine-dark text-snow">
      {problems.length > 0 && (
        <div role="alert" className="max-w-[980px] mx-auto px-6 pt-3">
          <p className="text-[13px] text-[#F6DAD6] font-semibold">
            Almost — a couple of things still need an answer:
          </p>
          <ul className="text-[13px] text-[#F6DAD6] list-disc pl-5 mt-1">
            {problems.map((problem) => (
              <li key={problem.field}>{problem.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-w-[980px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-[#AEC4B7]" aria-live="polite">
          <span className={status === "error" ? "text-[#F6DAD6]" : "text-[#CFE0D5]"}>
            {STATUS_COPY[status]}
          </span>
          {status === "saved" && lastSavedAt ? ` · ${agoLabel(lastSavedAt)}` : ""}
          {submitted ? " · marked as final" : ""}
        </p>

        <button
          type="button"
          disabled={finishing}
          onClick={async () => {
            setFinishing(true);
            await finish();
            setFinishing(false);
          }}
          className="text-sm bg-gold text-[#2B1D02] font-semibold px-4 py-2 rounded-md hover:bg-[#C68C0F] disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-snow"
        >
          {finishing ? "Saving…" : submitted ? "Update my answer" : "Save & finish →"}
        </button>
      </div>
    </div>
  );
}
