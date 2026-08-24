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
});
