import type { HeatmapMonthGrid, DensityTier } from "@/lib/availabilityHeatmap";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A single-hue lightness ramp rather than a multi-hue scale — it matches the
 * site's flat, mono-accented language and sidesteps the contrast problems
 * red-to-green ramps run into. Text colour flips on the darker tiers so the
 * in-cell numerals stay readable at every stop.
 */
const TIER_CLASSES: Record<DensityTier, string> = {
  0: "bg-paper border-line text-ink-soft",
  1: "bg-[#E4EFDE] border-[#CBE0C2] text-[#2E5B3D]",
  2: "bg-[#B6D6A2] border-[#93BE7C] text-[#1D3A20]",
  3: "bg-[#6FA860] border-[#5A8F4C] text-white",
  4: "bg-[#2E5B3D] border-[#1F3B2E] text-white",
};

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function describe(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return LONG_DATE.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Read-only display, not an input — so no button semantics, unlike the
 * guest-facing grid. Density is carried by a visible numeral in every cell
 * *and* the accessible label, so it survives being unable to distinguish the
 * shades at all (§14).
 */
export function AdminHeatmap({
  grids,
  totalRespondents,
}: {
  grids: HeatmapMonthGrid[];
  totalRespondents: number;
}) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {grids.map((grid) => (
          <div key={grid.label}>
            <h3 className="font-serif text-base mb-2">{grid.label}</h3>
            <div
              className="grid grid-cols-7 gap-[3px] mb-1 text-center font-mono text-[10px] text-ink-soft"
              aria-hidden="true"
            >
              {WEEKDAYS.map((day, i) => (
                <span key={`${day}-${i}`}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-[3px]" role="group" aria-label={grid.label}>
              {grid.cells.map((cell, i) => {
                if (cell.kind === "blank") {
                  return (
                    <div key={`blank-${i}`} aria-hidden="true" className="aspect-square" />
                  );
                }

                return (
                  <div
                    key={cell.date}
                    aria-label={`${describe(cell.date)} — ${cell.label}${
                      cell.isBlackout ? ", Ikon blackout" : ""
                    }`}
                    title={`${describe(cell.date)} — ${cell.label}`}
                    className={`aspect-square rounded border flex flex-col items-center justify-center leading-none ${
                      TIER_CLASSES[cell.tier]
                    } ${cell.isBlackout ? "outline outline-1 outline-dashed outline-rust" : ""}`}
                  >
                    <span className="text-[11px]">{cell.dayOfMonth}</span>
                    {/* The number, not just the shade, is what makes density
                        legible without colour perception. Days nobody has
                        marked show no number at all — across ~50 empty cells a
                        literal 0 is noise, and a bare date reads as "nobody"
                        once the caption says so. The accessible label still
                        spells it out either way. */}
                    {cell.available + cell.maybe > 0 && (
                      <span className="font-mono text-[9px] opacity-90">
                        {cell.available}
                        {cell.maybe > 0 ? `+${cell.maybe}` : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-soft mt-4">
        Each cell shows the day, then how many said yes — and after a{" "}
        <span className="font-mono">+</span>, how many said maybe. A date on its
        own means nobody has marked it yet. Shading blends the two, counting a
        maybe as a quarter of a yes.{" "}
        {totalRespondents > 0
          ? `Out of ${totalRespondents} finished ${
              totalRespondents === 1 ? "response" : "responses"
            }.`
          : "No finished responses yet."}
      </p>
    </div>
  );
}
