import type { TallyRow } from "@/lib/destinationTally";

/**
 * A share is easier to read as a bar than as a number, but the bar can't be
 * the only carrier — the count and percentage are always spelled out, so the
 * table works without perceiving the bar at all.
 */
export function AdminDestinationTally({ rows }: { rows: TallyRow[] }) {
  const leader = rows[0]?.votes ?? 0;
  const tiedAtTop = rows.filter((row) => row.votes === leader && leader > 0).length > 1;

  return (
    <div className="border border-line rounded-lg overflow-hidden">
      {rows.map((row) => (
        <div
          key={row.slug}
          className="px-4 py-3 border-b border-line last:border-b-0 bg-paper"
        >
          <div className="flex justify-between items-baseline gap-3 mb-1.5">
            <span className="text-sm">{row.name}</span>
            <span className="font-mono text-sm text-ink-soft whitespace-nowrap">
              {row.votes} {row.votes === 1 ? "vote" : "votes"}
              {row.votes > 0 && ` · ${Math.round(row.share * 100)}%`}
            </span>
          </div>
          {/* Presentational: every number it encodes is already in the text
              above, so it's hidden from assistive tech rather than repeated. */}
          <div className="h-1.5 bg-green-tint rounded-full overflow-hidden" aria-hidden="true">
            <div
              className="h-full bg-pine rounded-full"
              style={{ width: `${Math.round(row.share * 100)}%` }}
            />
          </div>
        </div>
      ))}

      {tiedAtTop && (
        <p className="px-4 py-2.5 text-xs text-ink-soft bg-snow border-t border-line">
          No clear favourite yet — the top choices are tied.
        </p>
      )}
    </div>
  );
}
