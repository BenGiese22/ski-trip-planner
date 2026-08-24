import type { DetailTile as DetailTileData } from "@/data/types";

const BORDER_COLOR_BY_INDEX = [
  "border-l-pine", // on the mountain
  "border-l-ink-soft", // getting around
  "border-l-gold", // food, drink & town
  "border-l-green-mid", // off the snow
];

export function DetailTile({ tile, index }: { tile: DetailTileData; index: number }) {
  return (
    <div
      className={`bg-snow rounded-lg p-3.5 border-l-[3px] ${BORDER_COLOR_BY_INDEX[index % 4]}`}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-soft mb-2">
        {tile.tileLabel}
      </p>
      <ul className="list-disc pl-4 space-y-1">
        {tile.bullets.map((bullet) => (
          <li key={bullet} className="text-sm text-ink">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}
