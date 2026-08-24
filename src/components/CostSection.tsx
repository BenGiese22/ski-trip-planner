import { costAssumptions, costSources } from "@/data/costAssumptions";
import { estimateTripCost } from "@/lib/costs";
import { formatUsd, formatUsdRange } from "@/lib/format";
import { SourceLine } from "./SourceLine";

const EXAMPLE = estimateTripCost({
  airport: "SFO",
  destinationSlug: "summitCounty",
  skiDays: 2,
  gearStatus: "rental",
  nights: 4,
  foodDays: 4,
});

export function CostSection() {
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

      <div className="border border-line rounded-lg overflow-hidden">
        {EXAMPLE.lineItems.map((item) => (
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
          <span className="font-mono">{formatUsdRange(EXAMPLE.total)}</span>
        </div>
      </div>
      <p className="text-xs text-ink-soft mt-2.5">
        Shown for a &ldquo;2 ski days, need a rental, flying from SFO to
        Summit County, 4 nights&rdquo; example — your own version will differ
        based on your airport, destination, and gear. All figures are
        planning estimates, not quotes.
      </p>
      <SourceLine sources={costSources} />
    </div>
  );
}
