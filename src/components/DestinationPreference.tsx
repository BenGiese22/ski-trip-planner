"use client";

import type { DestinationSlug } from "@/data/types";
import { useResponse } from "./ResponseProvider";

/**
 * Sits on each destination card, where people are already reading about the
 * option — a dropdown further down the page was easy to miss, and gave no clue
 * what choosing did.
 *
 * A button rather than a radio input: it has to be un-pickable too, and a
 * radio group with no "none" option can't be returned to its initial state.
 */
export function DestinationPreference({ slug }: { slug: DestinationSlug }) {
  const { response, update } = useResponse();

  // Nothing to save into until intake is done (§16 decision 7).
  if (!response) return null;

  const chosen = response.destinationSlug === slug;

  return (
    <div className="mt-3.5 pt-3.5 border-t border-line flex items-center gap-3 flex-wrap">
      <button
        type="button"
        aria-pressed={chosen}
        onClick={() =>
          update({ destinationSlug: chosen ? null : slug }, { immediate: true })
        }
        className={`text-[13px] border rounded-md px-3 py-1.5 focus:outline-2 focus:outline-offset-2 focus:outline-pine ${
          chosen
            ? "border-gold bg-[#FFFAEF] font-semibold text-gold-deep"
            : "border-line bg-paper hover:border-gold"
        }`}
      >
        {chosen ? "✓ This is my pick" : "Prefer this one"}
      </button>
      {chosen && (
        <span className="text-xs text-ink-soft">
          The cost estimate below now uses this destination.
        </span>
      )}
    </div>
  );
}
