import { describe, expect, it } from "vitest";
import { googleFlightsUrl } from "./flights";

describe("googleFlightsUrl", () => {
  it("builds the Google Flights deep link for a given origin and destination", () => {
    expect(googleFlightsUrl("SFO", "DEN")).toBe(
      "https://www.google.com/travel/flights?q=Flights%20from%20SFO%20to%20DEN",
    );
  });

  it("works for any origin/destination pair", () => {
    expect(googleFlightsUrl("ORD", "HDN")).toBe(
      "https://www.google.com/travel/flights?q=Flights%20from%20ORD%20to%20HDN",
    );
  });

  it("appends a date range as a natural-language phrase", () => {
    expect(
      googleFlightsUrl("ORD", "DEN", { start: "2027-01-28", end: "2027-01-31" }),
    ).toBe(
      "https://www.google.com/travel/flights?q=" +
        encodeURIComponent("Flights from ORD to DEN from Jan 28 to Jan 31"),
    );
  });

  it("uses 'on' phrasing for a single marked day", () => {
    expect(googleFlightsUrl("ORD", "DEN", { start: "2027-01-28", end: "2027-01-28" })).toBe(
      "https://www.google.com/travel/flights?q=" +
        encodeURIComponent("Flights from ORD to DEN on Jan 28"),
    );
  });
});
