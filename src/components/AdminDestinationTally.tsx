import type { TallyRow } from "@/lib/destinationTally";

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];

/**
 * Shows first choices as the headline, with the full placement spread beside
 * it — a destination nobody puts first but everyone puts second is exactly
 * what ranking was meant to surface, and a single count would hide it.
 */
export function AdminDestinationTally({ rows }: { rows: TallyRow[] }) {
  const leader = rows[0]?.firstChoices ?? 0;
  const tiedAtTop =
    rows.filter((row) => row.firstChoices === leader && leader > 0).length > 1;

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {rows.map((row) => (
        <div
          key={row.slug}
          className="px-4 py-3 border-b border-line last:border-b-0 bg-paper"
        >
          <div className="flex justify-between items-baseline gap-3 mb-1.5 flex-wrap">
            <span className="text-sm">{row.name}</span>
            <span className="font-mono text-sm text-ink-soft whitespace-nowrap">
              {row.firstChoices} {row.firstChoices === 1 ? "first choice" : "first choices"}
              {row.firstChoices > 0 && ` · ${Math.round(row.share * 100)}%`}
            </span>
          </div>

          {/* Presentational: the numbers it encodes are all spelled out below. */}
          <div className="h-1.5 bg-green-tint rounded-full overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-pine rounded-full"
              style={{ width: `${Math.round(row.share * 100)}%` }}
            />
          </div>

          <p className="text-xs text-ink-soft mt-1.5">
            {row.averageRank === null
              ? "Not ranked by anyone yet"
              : `${row.placements
                  .map((count, i) => `${count} × ${ORDINALS[i]}`)
                  .join(", ")} · average rank ${row.averageRank.toFixed(1)}`}
          </p>
        </div>
      ))}

      {tiedAtTop && (
        <p className="px-4 py-2.5 text-xs text-ink-soft bg-snow border-t border-line">
          Tied on first choices — the average rank above is the tiebreaker worth
          reading.
        </p>
      )}
    </div>
  );
}
