import type { Destination } from "@/data/types";
import { formatUsdRange } from "@/lib/format";
import { DetailTile } from "./DetailTile";
import { SourceLine } from "./SourceLine";

const BADGE_CLASSES = {
  gold: "bg-[#FBEDCB] text-gold-deep",
  pine: "bg-green-tint text-[#2E5B3D]",
};

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <div
      data-testid={`destination-${destination.slug}`}
      className={`bg-paper border rounded-xl p-5 sm:p-[22px] ${
        destination.badge.tone === "gold" ? "border-2 border-gold" : "border-line"
      }`}
    >
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <h3 className="font-serif font-bold text-lg">{destination.name}</h3>
        <span
          className={`font-mono text-[11px] px-2.5 py-1 rounded whitespace-nowrap ${BADGE_CLASSES[destination.badge.tone]}`}
        >
          {destination.badge.label}
        </span>
      </div>

      <div className="flex gap-4 flex-wrap mt-2 mb-3.5 text-sm text-ink-soft">
        <div>
          <span className="font-mono text-pine-dark">{destination.driveTimeFromDenver}</span>{" "}
          drive from DEN{destination.driveNote ? ` — ${destination.driveNote}` : ""}
        </div>
        <div>
          <span className="font-mono text-pine-dark">
            {formatUsdRange(destination.costRangePerPerson)}
          </span>{" "}
          est. per person
        </div>
        {destination.directFlightAirport && (
          <div>Direct seasonal flights to {destination.directFlightAirport} this winter</div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3.5">
        {destination.tiles.map((tile, i) => (
          <DetailTile key={tile.tileLabel} tile={tile} index={i} />
        ))}
      </div>

      <SourceLine sources={destination.sources} />
    </div>
  );
}
