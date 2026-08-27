import { describe, expect, it } from "vitest";
import { buildCostRollup } from "./adminCostRollup";
import { PASS_HOLDER_ASSUMED_SKI_DAYS } from "./respondentCosts";
import type { Respondent } from "@/db/schema";

function respondent(overrides: Partial<Respondent> = {}): Respondent {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    cookieToken: "00000000-0000-4000-8000-000000000001",
    name: "Jamie Rivera",
    email: "jamie@example.com",
    plusOne: false,
    homeAirport: "SFO",
    skiLevel: "intermediate",
    skiDays: 2,
    alreadyHasPass: false,
    gearStatus: "rental",
    plusOneSkiDays: null,
    plusOneAlreadyHasPass: false,
    plusOneGearStatus: null,
    notes: null,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const entry = (r: Respondent, topChoice: "steamboat" | "summitCounty" | "winterPark" | null) => ({
  respondent: r,
  topChoice,
});

describe("buildCostRollup", () => {
  it("has nothing to total when nobody has finished", () => {
    const rollup = buildCostRollup([]);
    expect(rollup.rows).toEqual([]);
    expect(rollup.groupTotal).toEqual([0, 0]);
  });

  it("produces one row per respondent, named so Ben can tell them apart", () => {
    const rollup = buildCostRollup([
      entry(respondent({ id: "a", name: "Ana" }), "summitCounty"),
      entry(respondent({ id: "b", name: "Cara" }), "winterPark"),
    ]);
    expect(rollup.rows.map((r) => r.name)).toEqual(["Ana", "Cara"]);
  });

  it("counts a plus-one as two people in one row", () => {
    const rollup = buildCostRollup([
      entry(
        respondent({ plusOne: true, plusOneSkiDays: 2, plusOneGearStatus: "own" }),
        "summitCounty",
      ),
    ]);
    expect(rollup.rows[0].people).toHaveLength(2);
    expect(rollup.rows[0].headcount).toBe(2);
  });

  it("sums the group total across every person, plus-ones included", () => {
    const rollup = buildCostRollup([
      entry(respondent({ id: "a" }), "summitCounty"),
      entry(
        respondent({ id: "b", plusOne: true, plusOneSkiDays: 2, plusOneGearStatus: "own" }),
        "summitCounty",
      ),
    ]);

    const summed = rollup.rows.reduce<[number, number]>(
      (acc, row) => (row.total ? [acc[0] + row.total[0], acc[1] + row.total[1]] : acc),
      [0, 0],
    );
    expect(rollup.groupTotal).toEqual(summed);
    expect(rollup.headcount).toBe(3);
  });

  it("prices each row against that person's own top choice", () => {
    const rollup = buildCostRollup([
      entry(respondent({ id: "a", homeAirport: "ORD" }), "steamboat"),
    ]);
    const labels = rollup.rows[0].people[0].estimate.lineItems.map((l) => l.label);
    expect(labels).toContain("Flight, round trip (ORD)");
  });

  // Section 17 decision 6 — the assumption has to reach Ben's view too, not
  // just the guest's, or he'd read an estimated figure as a stated one.
  it("flags a row that leans on the pass-holder ski-days assumption", () => {
    const rollup = buildCostRollup([
      entry(
        respondent({ alreadyHasPass: true, skiDays: null, gearStatus: "rental" }),
        "summitCounty",
      ),
    ]);
    expect(rollup.rows[0].assumedSkiDays).toBe(true);
    expect(PASS_HOLDER_ASSUMED_SKI_DAYS).toBe(2);
  });

  it("does not flag a row where everyone stated their ski days", () => {
    const rollup = buildCostRollup([entry(respondent(), "summitCounty")]);
    expect(rollup.rows[0].assumedSkiDays).toBe(false);
  });

  // Shouldn't happen — finishProblems() requires a ranking before anyone can
  // submit — but a stale row must not crash the dashboard or silently
  // contribute zero to a total Ben is reading as complete.
  it("lists a respondent with no ranking but leaves them out of the total", () => {
    const withChoice = buildCostRollup([entry(respondent({ id: "a" }), "summitCounty")]);
    const withBoth = buildCostRollup([
      entry(respondent({ id: "a" }), "summitCounty"),
      entry(respondent({ id: "b", name: "Unranked" }), null),
    ]);

    expect(withBoth.rows).toHaveLength(2);
    expect(withBoth.rows.find((r) => r.name === "Unranked")?.total).toBeNull();
    expect(withBoth.groupTotal).toEqual(withChoice.groupTotal);
  });

  it("counts an unranked respondent's headcount even though they can't be priced", () => {
    const rollup = buildCostRollup([entry(respondent({ plusOne: true }), null)]);
    expect(rollup.headcount).toBe(2);
    expect(rollup.groupTotal).toEqual([0, 0]);
  });
});
