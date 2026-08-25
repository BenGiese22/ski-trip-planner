"use client";

import { useResponse } from "./ResponseProvider";

/**
 * The returning-visitor state (section 3). The reference content underneath
 * stays browsable exactly as it is for a first-time visitor — this only adds
 * the "we know who you are" header above the editable form.
 */
export function WelcomeBack() {
  const { response } = useResponse();
  if (!response) return null;

  const firstName = response.name.trim().split(/\s+/)[0];
  const marked = response.availability.filter((day) => day.status !== "unavailable").length;

  return (
    <div className="bg-green-tint border border-[#BFD9C4] rounded-xl p-5 mb-3.5">
      <h3 className="font-serif font-bold text-lg">Welcome back, {firstName}.</h3>
      <p className="text-sm text-ink-soft mt-1.5">
        {response.submittedAt
          ? "You've marked your answer as final — but nothing's locked. Change anything below and it saves itself."
          : "Everything you'd filled in is still here. Pick up wherever you left off."}
      </p>
      <ul className="text-[13px] text-ink-soft mt-2.5 flex gap-4 flex-wrap">
        <li>
          <span className="font-mono text-pine-dark">{response.homeAirport}</span> home
          airport
        </li>
        <li>
          <span className="font-mono text-pine-dark">{marked}</span>{" "}
          {marked === 1 ? "day" : "days"} marked
        </li>
        <li>
          {response.plusOne ? "Bringing a plus-one" : "Coming solo"}
        </li>
      </ul>
    </div>
  );
}
