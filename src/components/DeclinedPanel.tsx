"use client";

import { useResponse } from "./ResponseProvider";

/**
 * What a guest who bowed out sees on their way back in — the mirror of
 * `WelcomeBack`, and deliberately the same card, since "we know who you are"
 * is the same message either way.
 */
export function DeclinedPanel() {
  const { response, decline, reconsidering, reconsider } = useResponse();
  if (!decline || response || reconsidering) return null;

  const firstName = decline.name?.trim().split(/\s+/)[0];

  return (
    <div className="bg-green-tint border border-[#BFD9C4] rounded-xl p-5 mb-3.5">
      <h3 className="font-serif font-bold text-lg">
        {firstName ? `Thanks for letting Ben know, ${firstName}.` : "Thanks for letting Ben know."}
      </h3>
      <p className="text-sm text-ink-soft mt-1.5">
        You said you can&rsquo;t make it this time. If that changes, you can
        still fill in a response — nothing&rsquo;s locked.
      </p>
      <button
        type="button"
        onClick={reconsider}
        className="text-sm text-paper bg-pine px-4 py-2.5 rounded-md mt-3.5 hover:bg-pine-dark focus:outline-2 focus:outline-offset-2 focus:outline-pine"
      >
        Actually, I can make it
      </button>
    </div>
  );
}
