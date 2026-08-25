"use client";

import { costAssumptions, costSources } from "@/data/costAssumptions";
import { destinations } from "@/data/destinations";
import { estimateTripCost } from "@/lib/costs";
import { formatUsd, formatUsdRange } from "@/lib/format";
import { respondentCostBreakdown, PASS_HOLDER_ASSUMED_SKI_DAYS } from "@/lib/respondentCosts";
import type { TripCostEstimate } from "@/lib/costs";
import type { DestinationSlug } from "@/data/types";
import { SkiDaysControls } from "./SkiDaysControls";
import { SourceLine } from "./SourceLine";
import { useResponse } from "./ResponseProvider";

const EXAMPLE = estimateTripCost({
  airport: "SFO",
  destinationSlug: "summitCounty",
  skiDays: 2,
  gearStatus: "rental",
  nights: costAssumptions.tripLength.nights,
  foodDays: costAssumptions.tripLength.foodDays,
});

export function CostSection() {
  const { response } = useResponse();
  const twoDay = costAssumptions.ikonSessionPassByDays[2];

  return (
    <div>
      <p className="text-sm text-ink-soft mb-4">
        Most of this group is skiing 2–3 days, not a whole season — so the
        multi-day Ikon Session Pass is almost always the right product here,
        not the unlimited Base Pass. Anyone skiing just 1 day is better off
        with a standalone lift ticket, since the Session Pass doesn&rsquo;t
        come in a 1-day size.
      </p>

      <div className="border-2 border-gold rounded-lg p-4 mb-3.5">
        <div className="font-mono text-[11px] uppercase text-gold-deep mb-1">
          2-day Ikon Session Pass
        </div>
        <div className="font-mono text-2xl text-pine-dark">
          {formatUsd(twoDay.standard)}{" "}
          <span className="text-sm text-ink-soft font-sans">
            (student {formatUsd(twoDay.student)})
          </span>
        </div>
        <p className="text-[12.5px] text-ink-soft mt-1.5">
          Covers Copper, Winter Park, Steamboat, Eldora, and A-Basin. A 3-day
          version is also available (confirmed pricing:{" "}
          {formatUsd(costAssumptions.ikonSessionPassByDays[3].standard)},
          student {formatUsd(costAssumptions.ikonSessionPassByDays[3].student)}).
          There&rsquo;s no 1-day tier — see the standalone lift ticket note above.
        </p>
      </div>
      <p className="text-xs text-ink-soft mb-4.5">
        Ben and Megan already hold the season-long Base Pass, so you won&rsquo;t
        see that option pushed here — it only pencils out if you&rsquo;re
        planning more than one trip to these mountains this winter, which is
        unlikely for most of the group.
      </p>

      {response ? <PersonalisedCosts /> : <ExampleCosts />}

      <SourceLine sources={costSources} />
    </div>
  );
}

function PersonalisedCosts() {
  const { response } = useResponse();
  if (!response) return null;

  const destination = destinations.find((d) => d.slug === response.destinationSlug);

  return (
    <>
      <h3 className="font-serif text-base mb-2.5">Your ski days and gear</h3>
      <SkiDaysControls />
      <p className="text-xs text-ink-soft mt-2.5 mb-5">
        Both selections save to your response, same as everything else on this
        page — the table below and Ben&rsquo;s group rollup both read from what
        you pick here.
      </p>

      {!destination ? (
        <p className="text-sm text-ink-soft border border-line rounded-lg p-4">
          Pick a destination up in &ldquo;Where to go&rdquo; and this becomes
          your own estimate rather than an example.
        </p>
      ) : (
        <Breakdown destinationName={destination.name} destinationSlug={destination.slug} />
      )}
    </>
  );
}

function Breakdown({
  destinationName,
  destinationSlug,
}: {
  destinationName: string;
  destinationSlug: DestinationSlug;
}) {
  const { response } = useResponse();
  if (!response) return null;

  const breakdown = respondentCostBreakdown(
    {
      ...response,
      // The calculator only reads the answer columns; identity and timestamps
      // are irrelevant to it and never leave the server anyway.
      id: "",
      cookieToken: "",
      notes: response.notes,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    destinationSlug,
  );

  const anyAssumed = breakdown.people.some((person) => person.assumedSkiDays);

  return (
    <>
      <p className="text-sm text-ink-soft mb-3">
        Estimated for <strong className="text-ink">{destinationName}</strong>,
        flying from <strong className="text-ink">{response.homeAirport}</strong>.
      </p>

      <div className="flex flex-col gap-4">
        {breakdown.people.map((person) => (
          <div key={person.label}>
            {breakdown.people.length > 1 && (
              <h4 className="font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1.5">
                {person.label}
              </h4>
            )}
            <CostTable estimate={person.estimate} />
          </div>
        ))}
      </div>

      {breakdown.people.length > 1 && (
        <div className="flex justify-between px-4 py-2.5 text-sm font-semibold bg-pine text-snow rounded-lg mt-3">
          <span>Both of you, together</span>
          <span className="font-mono">{formatUsdRange(breakdown.total)}</span>
        </div>
      )}

      <p className="text-xs text-ink-soft mt-2.5">
        Based on {costAssumptions.tripLength.nights} nights — the trip length
        isn&rsquo;t settled yet, so that&rsquo;s an assumption, not a plan.
        {anyAssumed
          ? ` Rental costs for anyone who already has a pass assume ${PASS_HOLDER_ASSUMED_SKI_DAYS} ski days, since there's no ski-days answer to scale from.`
          : ""}{" "}
        All figures are planning estimates, not quotes.
      </p>
    </>
  );
}

function ExampleCosts() {
  return (
    <>
      <CostTable estimate={EXAMPLE} />
      <p className="text-xs text-ink-soft mt-2.5">
        Shown for a &ldquo;2 ski days, need a rental, flying from SFO to
        Summit County, {costAssumptions.tripLength.nights} nights&rdquo;
        example. Start your response up top and this becomes your own numbers.
        All figures are planning estimates, not quotes.
      </p>
    </>
  );
}

function CostTable({ estimate }: { estimate: TripCostEstimate }) {
  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {estimate.lineItems.map((item) => (
        <div
          key={item.label}
          className="flex justify-between px-4 py-2.5 text-sm border-b border-line last:border-b-0"
        >
          <span>{item.label}</span>
          <span className="font-mono text-ink-soft">{formatUsdRange(item.range)}</span>
        </div>
      ))}
      <div className="flex justify-between px-4 py-2.5 text-sm font-semibold bg-pine text-snow">
        <span>Estimated total, per person</span>
        <span className="font-mono">{formatUsdRange(estimate.total)}</span>
      </div>
    </div>
  );
}
