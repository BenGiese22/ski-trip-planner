import type { DestinationSlug } from "@/data/types";
import { buildMonthGrids } from "./dates";

/**
 * A "maybe" is real signal but much weaker than a yes (PLAN.md §17 decision
 * 2). Weighting them equally would make a day the whole group is unsure about
 * look identical to one the whole group is free for.
 */
export const MAYBE_WEIGHT = 0.25;

export type DensityTier = 0 | 1 | 2 | 3 | 4;

const TIER_LABELS = [
  "nobody yet",
  "a few",
  "some",
  "most",
  "everyone",
] as const;

export type HeatmapCell =
  | { kind: "blank" }
  | {
      kind: "day";
      date: string;
      dayOfMonth: number;
      isBlackout: boolean;
      available: number;
      maybe: number;
      /** available + MAYBE_WEIGHT × maybe. */
      score: number;
      /** score as a share of the group, 0–1. */
      ratio: number;
      tier: DensityTier;
      /** Reads the density without needing to perceive colour (§14). */
      label: string;
    };

export type HeatmapMonthGrid = {
  label: string;
  year: number;
  month: number;
  cells: HeatmapCell[];
};

export type DayCount = {
  date: string;
  available: number;
  maybe: number;
};

/**
 * Five bands. Guarded against a zero group size and against a score above it,
 * so a stale count can't produce a tier with no matching style.
 */
export function densityTier(score: number, totalRespondents: number): DensityTier {
  if (totalRespondents <= 0 || score <= 0) return 0;

  const ratio = Math.min(1, score / totalRespondents);
  if (ratio >= 1) return 4;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/**
 * The host-side view of the same three month grids the guests fill in — which
 * is why it reuses `buildMonthGrids()` rather than repeating the weekday
 * alignment, out-of-window blanking and blackout marking.
 *
 * Counts for dates outside the window are ignored rather than trusted: the
 * grid decides which days exist.
 */
export function buildHeatmap(
  counts: DayCount[],
  totalRespondents: number,
  destinationSlug?: DestinationSlug,
): HeatmapMonthGrid[] {
  const byDate = new Map(counts.map((c) => [c.date, c]));

  return buildMonthGrids(destinationSlug).map((grid) => ({
    label: grid.label,
    year: grid.year,
    month: grid.month,
    cells: grid.cells.map((cell): HeatmapCell => {
      if (cell.kind === "blank") return { kind: "blank" };

      const counted = byDate.get(cell.date);
      const available = counted?.available ?? 0;
      const maybe = counted?.maybe ?? 0;
      const score = available + MAYBE_WEIGHT * maybe;
      const ratio = totalRespondents > 0 ? Math.min(1, score / totalRespondents) : 0;
      const tier = densityTier(score, totalRespondents);

      return {
        kind: "day",
        date: cell.date,
        dayOfMonth: cell.dayOfMonth,
        isBlackout: cell.isBlackout,
        available,
        maybe,
        score,
        ratio,
        tier,
        label:
          available === 0 && maybe === 0
            ? TIER_LABELS[0]
            : `${available} available${maybe > 0 ? `, ${maybe} maybe` : ""}`,
      };
    }),
  }));
}
