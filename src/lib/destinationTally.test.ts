import { describe, expect, it } from "vitest";
import { destinations } from "@/data/destinations";
import { tallyDestinations } from "./destinationTally";

/** One respondent's full ranking, best first. */
const ranking = (...slugs: string[]) => slugs as never[];

describe("tallyDestinations", () => {
  // Ben needs to see "nobody picked Winter Park", not silence where Winter
  // Park should be.
  it("lists every destination even when nobody has ranked anything", () => {
    const rows = tallyDestinations([], 0);
    expect(rows).toHaveLength(destinations.length);
    expect(rows.every((r) => r.firstChoices === 0)).toBe(true);
  });

  it("counts first choices", () => {
    const rows = tallyDestinations(
      [
        ranking("steamboat", "winterPark", "summitCounty"),
        ranking("steamboat", "summitCounty", "winterPark"),
        ranking("winterPark", "steamboat", "summitCounty"),
      ],
      3,
    );
    expect(rows.find((r) => r.slug === "steamboat")?.firstChoices).toBe(2);
    expect(rows.find((r) => r.slug === "winterPark")?.firstChoices).toBe(1);
    expect(rows.find((r) => r.slug === "summitCounty")?.firstChoices).toBe(0);
  });

  // The whole point of ranking over a single pick: a destination nobody puts
  // first but everybody puts second is a real answer.
  it("counts placements at every rank, not just the top", () => {
    const rows = tallyDestinations(
      [
        ranking("steamboat", "summitCounty", "winterPark"),
        ranking("winterPark", "summitCounty", "steamboat"),
      ],
      2,
    );
    const summit = rows.find((r) => r.slug === "summitCounty");
    expect(summit?.firstChoices).toBe(0);
    expect(summit?.placements).toEqual([0, 2, 0]);
  });

  it("averages the rank each destination was given", () => {
    const rows = tallyDestinations(
      [
        ranking("steamboat", "summitCounty", "winterPark"),
        ranking("summitCounty", "steamboat", "winterPark"),
      ],
      2,
    );
    expect(rows.find((r) => r.slug === "steamboat")?.averageRank).toBe(1.5);
    expect(rows.find((r) => r.slug === "winterPark")?.averageRank).toBe(3);
  });

  it("orders by first choices, most popular first", () => {
    const rows = tallyDestinations(
      [
        ranking("winterPark", "summitCounty", "steamboat"),
        ranking("winterPark", "steamboat", "summitCounty"),
        ranking("summitCounty", "winterPark", "steamboat"),
      ],
      3,
    );
    expect(rows[0].slug).toBe("winterPark");
  });

  // A consensus second choice should outrank a polarising one when first
  // choices are level — that is exactly the signal ranking buys.
  it("breaks a first-choice tie by average rank", () => {
    const rows = tallyDestinations(
      [
        ranking("steamboat", "summitCounty", "winterPark"),
        ranking("winterPark", "summitCounty", "steamboat"),
      ],
      2,
    );
    // Steamboat and Winter Park both have one first choice; Summit County has
    // none but is everyone's second, so it should not sit last.
    expect(rows.find((r) => r.slug === "summitCounty")!.averageRank).toBe(2);
    const tied = rows.filter((r) => r.firstChoices === 1).map((r) => r.slug);
    expect(tied).toHaveLength(2);
  });

  it("computes first-choice share against everyone who finished", () => {
    const rows = tallyDestinations([ranking("steamboat", "summitCounty", "winterPark")], 4);
    expect(rows.find((r) => r.slug === "steamboat")?.share).toBe(0.25);
  });

  it("never divides by zero", () => {
    const rows = tallyDestinations([], 0);
    expect(rows.every((r) => r.share === 0)).toBe(true);
    expect(rows.every((r) => r.averageRank === null)).toBe(true);
  });

  it("carries the display name so the UI needn't look it up again", () => {
    const rows = tallyDestinations([ranking("steamboat", "summitCounty", "winterPark")], 1);
    expect(rows.find((r) => r.slug === "steamboat")?.name).toBe(
      destinations.find((d) => d.slug === "steamboat")?.name,
    );
  });

  // Defensive: the Zod schema should make this impossible, but a stale row
  // shouldn't be able to break Ben's dashboard.
  it("ignores a ranking entry for a destination that no longer exists", () => {
    const rows = tallyDestinations([ranking("vail", "steamboat", "summitCounty")], 1);
    expect(rows).toHaveLength(destinations.length);
    expect(rows.find((r) => r.slug === "steamboat")?.placements[1]).toBe(1);
  });
});
