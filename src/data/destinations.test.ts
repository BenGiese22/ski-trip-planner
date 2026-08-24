import { describe, expect, it } from "vitest";
import { destinations } from "./destinations";
import { costAssumptions } from "./costAssumptions";

describe("destinations data shape", () => {
  it("has exactly three destinations with unique slugs", () => {
    expect(destinations).toHaveLength(3);
    const slugs = destinations.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every destination exactly four tiles", () => {
    for (const destination of destinations) {
      expect(destination.tiles).toHaveLength(4);
    }
  });

  it("keeps every tile's bullet list to 1-3 short bullets, not paragraphs", () => {
    for (const destination of destinations) {
      for (const tile of destination.tiles) {
        expect(tile.bullets.length).toBeGreaterThanOrEqual(1);
        expect(tile.bullets.length).toBeLessThanOrEqual(3);
        for (const bullet of tile.bullets) {
          expect(bullet.length).toBeLessThan(160);
        }
      }
    }
  });

  it("gives every destination at least one https source", () => {
    for (const destination of destinations) {
      expect(destination.sources.length).toBeGreaterThan(0);
      for (const source of destination.sources) {
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("has exactly one destination with a direct HDN flight option", () => {
    const withHdn = destinations.filter((d) => d.directFlightAirport === "HDN");
    expect(withHdn).toHaveLength(1);
    expect(withHdn[0].slug).toBe("steamboat");
  });

  it("has a lodging assumption for every destination slug", () => {
    for (const destination of destinations) {
      expect(
        costAssumptions.lodgingPerNightByDestination[destination.slug],
      ).toBeDefined();
    }
  });
});
