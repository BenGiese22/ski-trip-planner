import { destinations } from "@/data/destinations";
import { formatUsdRange } from "@/lib/format";
import { PASS_HOLDER_ASSUMED_SKI_DAYS } from "@/lib/respondentCosts";
import type { CostRollup } from "@/lib/adminCostRollup";

function destinationName(slug: string | null) {
  return destinations.find((d) => d.slug === slug)?.name ?? null;
}

export function AdminCostRollup({ rollup }: { rollup: CostRollup }) {
  const anyAssumed = rollup.rows.some((row) => row.assumedSkiDays);
  const anyUnpriced = rollup.rows.some((row) => row.total === null);

  return (
    <div>
      <div className="border border-line rounded-lg overflow-hidden">
        {rollup.rows.map((row) => (
          <div
            key={row.email}
            className="px-4 py-3 border-b border-line last:border-b-0 bg-paper"
          >
            <div className="flex justify-between items-baseline gap-3 flex-wrap">
              <span className="text-sm">
                {row.name}
                {row.headcount > 1 && (
                  <span className="text-ink-soft"> +1</span>
                )}
                {row.assumedSkiDays && (
                  // The assumption has to be visible where the number is read,
                  // not only in the caption underneath (§17 decision 6).
                  <span
                    className="ml-2 font-mono text-[10px] text-gold-deep"
                    title={`Rental scaled at an assumed ${PASS_HOLDER_ASSUMED_SKI_DAYS} ski days`}
                  >
                    est.
                  </span>
                )}
              </span>
              <span className="font-mono text-sm text-ink-soft whitespace-nowrap">
                {row.total ? formatUsdRange(row.total) : "—"}
              </span>
            </div>
            <p className="text-xs text-ink-soft mt-0.5">
              {row.homeAirport}
              {destinationName(row.destinationSlug)
                ? ` · ${destinationName(row.destinationSlug)}`
                : " · no ranking yet"}
            </p>
          </div>
        ))}

        <div className="flex justify-between px-4 py-2.5 text-sm font-semibold bg-pine text-snow">
          <span>
            Everyone, together{" "}
            <span className="font-normal opacity-80">
              ({rollup.headcount} {rollup.headcount === 1 ? "person" : "people"})
            </span>
          </span>
          <span className="font-mono">{formatUsdRange(rollup.groupTotal)}</span>
        </div>
      </div>

      <p className="text-xs text-ink-soft mt-2.5">
        Each row is priced against that person&rsquo;s own first-choice
        destination and home airport, so the total mixes destinations if the
        group hasn&rsquo;t converged.
        {anyAssumed
          ? ` Rows marked "est." include someone who already has a pass, whose rental is scaled at an assumed ${PASS_HOLDER_ASSUMED_SKI_DAYS} ski days.`
          : ""}
        {anyUnpriced
          ? " Anyone without a ranking is counted in the headcount but can't be priced, so they're left out of the total."
          : ""}{" "}
        All figures are planning estimates, not quotes.
      </p>
    </div>
  );
}
