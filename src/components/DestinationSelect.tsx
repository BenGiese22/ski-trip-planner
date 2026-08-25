"use client";

import { useId } from "react";
import { destinations } from "@/data/destinations";
import { destinationSlugSchema } from "@/lib/schemas";
import { useResponse } from "./ResponseProvider";

/**
 * One select, not a ranking. It writes a single rank-1 vote (section 16,
 * decision 3) and drives which numbers the cost section shows.
 */
export function DestinationSelect() {
  const { response, update } = useResponse();
  const id = useId();

  if (!response) return null;

  return (
    <div className="bg-paper border border-line rounded-xl p-5 mt-3.5">
      <label
        className="block font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1.5"
        htmlFor={id}
      >
        Which would you prefer?
      </label>
      <select
        id={id}
        className="w-full sm:w-auto border border-line rounded-md px-3 py-2.5 text-sm bg-paper text-ink focus:outline-2 focus:outline-offset-2 focus:outline-pine"
        value={response.destinationSlug ?? ""}
        onChange={(e) => {
          const parsed = destinationSlugSchema.safeParse(e.target.value);
          if (parsed.success) update({ destinationSlug: parsed.data }, { immediate: true });
        }}
      >
        <option value="">No preference yet</option>
        {destinations.map((destination) => (
          <option key={destination.slug} value={destination.slug}>
            {destination.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-soft mt-2">
        Not a vote that binds anyone — it just tells us where the group leans,
        and personalises the cost estimate below.
      </p>
    </div>
  );
}
