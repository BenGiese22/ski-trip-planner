import { describe, expect, it } from "vitest";
import { formatUsd, formatUsdRange } from "./format";

describe("formatUsd", () => {
  it("formats a whole-dollar amount with no cents", () => {
    expect(formatUsd(319)).toBe("$319");
  });

  it("rounds to the nearest dollar", () => {
    expect(formatUsd(219.6)).toBe("$220");
  });
});

describe("formatUsdRange", () => {
  it("formats a low/high tuple as a dash-separated range", () => {
    expect(formatUsdRange([900, 1300])).toBe("$900 – $1,300");
  });

  it("collapses to a single value when low equals high", () => {
    expect(formatUsdRange([319, 319])).toBe("$319");
  });
});
