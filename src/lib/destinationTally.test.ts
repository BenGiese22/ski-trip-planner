import { describe, expect, it } from "vitest";
import { destinations } from "@/data/destinations";
import { tallyDestinations } from "./destinationTally";

const vote = (destinationSlug: string) => ({ destinationSlug }) as never;

describe("tallyDestinations", () => {
  // Ben needs to see "nobody picked Winter Park", not silence where Winter
  // Park should be. Seeding from the destination list rather than from the
  // votes is what makes an unpopular option visible.
  it("lists every destination even when nobody voted at all", () => {
    const rows = tallyDestinations([], 0);
    expect(rows).toHaveLength(destinations.length);
    expect(rows.every((r) => r.votes === 0)).toBe(true);
    expect(new Set(rows.map((r) => r.slug))).toEqual(
      new Set(destinations.map((d) => d.slug)),
    );
  });

  it("lists a destination with no votes alongside ones that have them", () => {
    const rows = tallyDestinations([vote("steamboat"), vote("steamboat")], 2);
    const winterPark = rows.find((r) => r.slug === "winterPark");
    expect(winterPark).toBeDefined();
    expect(winterPark?.votes).toBe(0);
  });

  it("counts votes per destination", () => {
    const rows = tallyDestinations(
      [vote("steamboat"), vote("steamboat"), vote("winterPark")],
      3,
    );
    expect(rows.find((r) => r.slug === "steamboat")?.votes).toBe(2);
    expect(rows.find((r) => r.slug === "winterPark")?.votes).toBe(1);
    expect(rows.find((r) => r.slug === "summitCounty")?.votes).toBe(0);
  });

  it("orders by votes, most popular first", () => {
    const rows = tallyDestinations(
      [vote("winterPark"), vote("winterPark"), vote("summitCounty")],
      3,
    );
    expect(rows.map((r) => r.slug)).toEqual(["winterPark", "summitCounty", "steamboat"]);
  });

  // A wobbling order between renders makes a small table hard to read.
  it("breaks ties by the order destinations are declared in", () => {
    const rows = tallyDestinations([], 0);
    expect(rows.map((r) => r.slug)).toEqual(destinations.map((d) => d.slug));

    const tied = tallyDestinations([vote("winterPark"), vote("steamboat")], 2);
    expect(tied.map((r) => r.slug)).toEqual(["steamboat", "winterPark", "summitCounty"]);
  });

  it("carries the display name so the UI needn't look it up again", () => {
    const rows = tallyDestinations([vote("steamboat")], 1);
    expect(rows.find((r) => r.slug === "steamboat")?.name).toBe(
      destinations.find((d) => d.slug === "steamboat")?.name,
    );
  });

  // The denominator is everyone who finished, not everyone who voted. Those
  // are the same number for genuinely submitted responses — finishProblems()
  // requires a destination — but the share should describe the group, not the
  // subset that happened to answer this question.
  it("computes share against the finished responses, not the vote count", () => {
    const rows = tallyDestinations([vote("steamboat")], 4);
    expect(rows.find((r) => r.slug === "steamboat")?.share).toBe(0.25);
  });

  it("gives a unanimous choice a full share", () => {
    const rows = tallyDestinations([vote("steamboat"), vote("steamboat")], 2);
    expect(rows.find((r) => r.slug === "steamboat")?.share).toBe(1);
  });

  it("never divides by zero", () => {
    const rows = tallyDestinations([], 0);
    expect(rows.every((r) => r.share === 0)).toBe(true);
    expect(rows.every((r) => Number.isFinite(r.share))).toBe(true);
  });

  // Defensive: the Zod enum should make this impossible, but a stale row
  // shouldn't be able to crash Ben's dashboard.
  it("ignores a vote for a destination that no longer exists", () => {
    const rows = tallyDestinations([vote("vail"), vote("steamboat")], 2);
    expect(rows).toHaveLength(destinations.length);
    expect(rows.find((r) => r.slug === "steamboat")?.votes).toBe(1);
    expect(rows.reduce((sum, r) => sum + r.votes, 0)).toBe(1);
  });
});
