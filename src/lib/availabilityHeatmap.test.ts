import { describe, expect, it } from "vitest";
import {
  MAYBE_WEIGHT,
  buildHeatmap,
  densityTier,
  type HeatmapCell,
} from "./availabilityHeatmap";

const dayCells = (grids: ReturnType<typeof buildHeatmap>) =>
  grids.flatMap((g) => g.cells).filter((c): c is Extract<HeatmapCell, { kind: "day" }> =>
    c.kind === "day",
  );

const cellFor = (grids: ReturnType<typeof buildHeatmap>, date: string) =>
  dayCells(grids).find((c) => c.date === date);

describe("MAYBE_WEIGHT", () => {
  // Section 17 decision 2: a "maybe" is real signal but much weaker than a
  // yes. Weighting them equally would make a day everyone is unsure about
  // look identical to one everyone is free for.
  it("counts a maybe as a quarter of an available", () => {
    expect(MAYBE_WEIGHT).toBe(0.25);
  });
});

describe("densityTier", () => {
  it("is the empty tier when nobody can make it", () => {
    expect(densityTier(0, 10)).toBe(0);
  });

  it("is the top tier when everyone is available", () => {
    expect(densityTier(10, 10)).toBe(4);
  });

  it("climbs with the share of the group", () => {
    const tiers = [1, 3, 5, 8, 10].map((score) => densityTier(score, 10));
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(new Set(tiers).size).toBeGreaterThan(1);
  });

  it("never divides by zero when there are no responses", () => {
    expect(densityTier(0, 0)).toBe(0);
    expect(Number.isFinite(densityTier(0, 0))).toBe(true);
  });

  it("clamps a score above the group size to the top tier", () => {
    // Shouldn't happen, but a stale count shouldn't produce a tier with no
    // matching style.
    expect(densityTier(99, 10)).toBe(4);
  });
});

describe("buildHeatmap", () => {
  const counts = [
    { date: "2027-01-28", available: 6, maybe: 2 },
    { date: "2027-01-29", available: 3, maybe: 0 },
    { date: "2027-02-13", available: 1, maybe: 4 },
  ];

  it("returns the same three month grids as the guest calendar", () => {
    expect(buildHeatmap(counts, 8).map((g) => g.label)).toEqual([
      "January 2027",
      "February 2027",
      "March 2027",
    ]);
  });

  it("carries both raw numbers, not just the blended score", () => {
    const cell = cellFor(buildHeatmap(counts, 8), "2027-01-28");
    expect(cell?.available).toBe(6);
    expect(cell?.maybe).toBe(2);
  });

  it("scores available plus a quarter of each maybe", () => {
    const cell = cellFor(buildHeatmap(counts, 8), "2027-01-28");
    expect(cell?.score).toBe(6 + 0.25 * 2);
  });

  it("ranks a solidly-available day above one carried by maybes", () => {
    const grids = buildHeatmap(counts, 8);
    const solid = cellFor(grids, "2027-01-29"); // 3 available, 0 maybe -> 3
    const hedged = cellFor(grids, "2027-02-13"); // 1 available, 4 maybe -> 2
    expect(solid!.score).toBeGreaterThan(hedged!.score);
  });

  it("treats a day nobody mentioned as empty rather than missing", () => {
    const cell = cellFor(buildHeatmap(counts, 8), "2027-03-02");
    expect(cell).toBeDefined();
    expect(cell?.available).toBe(0);
    expect(cell?.maybe).toBe(0);
    expect(cell?.tier).toBe(0);
  });

  it("keeps out-of-window days blank, as the guest grid does", () => {
    const [jan, , mar] = buildHeatmap(counts, 8);
    expect(jan.cells.filter((c) => c.kind === "day")).toHaveLength(16);
    expect(mar.cells.filter((c) => c.kind === "day")).toHaveLength(15);
    expect(jan.cells.some((c) => c.kind === "blank")).toBe(true);
  });

  it("survives having no responses at all", () => {
    const grids = buildHeatmap([], 0);
    const cells = dayCells(grids);
    expect(cells).toHaveLength(59);
    expect(cells.every((c) => c.tier === 0)).toBe(true);
    expect(cells.every((c) => Number.isFinite(c.ratio))).toBe(true);
  });

  it("flags blackout days for information, independent of any destination", () => {
    expect(dayCells(buildHeatmap(counts, 8)).filter((c) => c.isBlackout)).toHaveLength(4);
  });

  // A blackout day can still carry counts — someone may have marked it before
  // a destination was chosen. The heatmap must render that rather than assume
  // it away.
  it("still reports density on a blackout day", () => {
    const cell = cellFor(buildHeatmap(counts, 8), "2027-02-13");
    expect(cell?.isBlackout).toBe(true);
    expect(cell?.available).toBe(1);
    expect(cell?.maybe).toBe(4);
  });

  it("ignores counts for dates outside the window", () => {
    const grids = buildHeatmap(
      [...counts, { date: "2027-07-04", available: 99, maybe: 99 }],
      8,
    );
    expect(dayCells(grids).some((c) => c.available === 99)).toBe(false);
    expect(dayCells(grids)).toHaveLength(59);
  });

  // Density must be readable without perceiving colour at all (§14).
  it("gives every day a text label describing its density", () => {
    for (const cell of dayCells(buildHeatmap(counts, 8))) {
      expect(cell.label.length).toBeGreaterThan(0);
    }
    expect(cellFor(buildHeatmap(counts, 8), "2027-01-28")?.label).toMatch(/6/);
  });
});
