"use client";

import { airports } from "@/data/airports";
import { googleFlightsUrl } from "@/lib/flights";
import { useResponse } from "./ResponseProvider";

/**
 * Once intake has run, only the respondent's own airport is worth showing —
 * nobody needs to read about the other two cities' flight options (section 3).
 * Before that, all three stand as reference content.
 */
export function FlightCards() {
  const { response } = useResponse();

  const shown = response
    ? airports.filter((airport) => airport.code === response.homeAirport)
    : airports;

  return (
    <div className="flex flex-col gap-3.5">
      {shown.map((airport) => (
        <div
          key={airport.code}
          className="bg-paper border border-line rounded-xl p-5 flex justify-between items-center gap-4 flex-wrap"
        >
          <div>
            <div className="font-mono text-xs text-gold-deep uppercase tracking-wide mb-1">
              {airport.code} — {airport.city}
            </div>
            <h3 className="text-xl">Nonstop to DEN</h3>
            {airport.hdnDirectSeasonal && (
              <p className="text-[13.5px] text-ink-soft mt-1.5">
                Also a direct seasonal option straight into Steamboat (HDN)
                this winter — worth comparing against connecting through DEN.
              </p>
            )}
          </div>
          <a
            className="text-sm text-paper bg-pine px-4 py-2.5 rounded-md no-underline whitespace-nowrap hover:bg-pine-dark"
            href={googleFlightsUrl(airport.code, "DEN")}
            target="_blank"
            rel="noopener noreferrer"
          >
            Check Google Flights →
          </a>
        </div>
      ))}
    </div>
  );
}
