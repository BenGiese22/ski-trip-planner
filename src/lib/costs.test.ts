import { describe, expect, it } from "vitest";
import { estimateTripCost } from "./costs";

describe("estimateTripCost", () => {
  it("includes flight, lodging, pass, rental, and food lines for a renter skiing 2 days", () => {
    const result = estimateTripCost({
      airport: "SFO",
      destinationSlug: "summitCounty",
      skiDays: 2,
      gearStatus: "rental",
      nights: 4,
      foodDays: 4,
    });

    const labels = result.lineItems.map((item) => item.label);
    expect(labels).toContain("Flight, round trip (SFO)");
    expect(labels).toContain("Lodging, 4 nights");
    expect(labels).toContain("2-day Ikon Session Pass");
    expect(labels.some((l) => l.toLowerCase().includes("rental"))).toBe(true);
    expect(labels.some((l) => l.toLowerCase().includes("food"))).toBe(true);
  });

  it("omits the rental line entirely when gear status is 'own', not a $0 line", () => {
    const result = estimateTripCost({
      airport: "SFO",
      destinationSlug: "summitCounty",
      skiDays: 2,
      gearStatus: "own",
      nights: 4,
      foodDays: 4,
    });

    const rentalLine = result.lineItems.find((item) =>
      item.label.toLowerCase().includes("rental"),
    );
    expect(rentalLine).toBeUndefined();
  });

  it("uses the fixed Ikon Session Pass price for a 2-day skier (low === high)", () => {
    const result = estimateTripCost({
      airport: "SFO",
      destinationSlug: "summitCounty",
      skiDays: 2,
      gearStatus: "own",
      nights: 4,
      foodDays: 4,
    });

    const passLine = result.lineItems.find((item) =>
      item.label.includes("Ikon Session Pass"),
    );
    expect(passLine?.range).toEqual([319, 319]);
  });

  it("uses the fixed 3-day Ikon Session Pass price for a 3-day skier", () => {
    const result = estimateTripCost({
      airport: "ORD",
      destinationSlug: "winterPark",
      skiDays: 3,
      gearStatus: "own",
      nights: 4,
      foodDays: 4,
    });

    const passLine = result.lineItems.find((item) =>
      item.label.includes("Ikon Session Pass"),
    );
    expect(passLine?.range).toEqual([429, 429]);
  });

  it("uses a standalone 1-day lift ticket range for a 1-day skier, not the Session Pass", () => {
    const result = estimateTripCost({
      airport: "MKE",
      destinationSlug: "steamboat",
      skiDays: 1,
      gearStatus: "own",
      nights: 4,
      foodDays: 4,
    });

    const passLine = result.lineItems.find((item) =>
      item.label.includes("Ikon Session Pass"),
    );
    expect(passLine).toBeUndefined();

    const ticketLine = result.lineItems.find((item) =>
      item.label.toLowerCase().includes("lift ticket"),
    );
    expect(ticketLine?.range).toEqual([180, 360]);
  });

  it("sums line item lows and highs into the total range", () => {
    const result = estimateTripCost({
      airport: "SFO",
      destinationSlug: "summitCounty",
      skiDays: 2,
      gearStatus: "own",
      nights: 4,
      foodDays: 4,
    });

    const expectedLow = result.lineItems.reduce((sum, item) => sum + item.range[0], 0);
    const expectedHigh = result.lineItems.reduce((sum, item) => sum + item.range[1], 0);
    expect(result.total).toEqual([expectedLow, expectedHigh]);
  });

  it("scales lodging and food by the given number of nights/days", () => {
    const result = estimateTripCost({
      airport: "SFO",
      destinationSlug: "summitCounty",
      skiDays: 2,
      gearStatus: "own",
      nights: 2,
      foodDays: 2,
    });

    const lodgingLine = result.lineItems.find((item) => item.label.includes("Lodging"));
    expect(lodgingLine?.range).toEqual([110, 200]); // [55,100] * 2 nights
  });
});
