import { describe, expect, it } from "vitest";
import {
  WINDOW_END,
  WINDOW_START,
  buildMonthGrids,
  datesInRange,
  eachDateInWindow,
  isBlackoutDate,
  isInWindow,
  quickPicks,
} from "./dates";

describe("the trip window", () => {
  it("runs Jan 16 through Mar 15 2027 inclusive", () => {
    expect(WINDOW_START).toBe("2027-01-16");
    expect(WINDOW_END).toBe("2027-03-15");

    expect(isInWindow("2027-01-16")).toBe(true);
    expect(isInWindow("2027-03-15")).toBe(true);
  });

  it("excludes the days just outside either edge", () => {
    expect(isInWindow("2027-01-15")).toBe(false);
    expect(isInWindow("2027-03-16")).toBe(false);
    expect(isInWindow("2026-12-28")).toBe(false);
  });

  it("enumerates every day in the window, 59 in total", () => {
    const all = eachDateInWindow();

    // Jan 16-31 (16) + all of Feb 2027 (28, not a leap year) + Mar 1-15 (15).
    expect(all).toHaveLength(59);
    expect(all[0]).toBe("2027-01-16");
    expect(all.at(-1)).toBe("2027-03-15");
    expect(new Set(all).size).toBe(59);
  });
});

describe("buildMonthGrids", () => {
  it("returns exactly the three months the window spans", () => {
    const grids = buildMonthGrids();
    expect(grids.map((g) => g.label)).toEqual([
      "January 2027",
      "February 2027",
      "March 2027",
    ]);
  });

  it("pads every grid to whole weeks so the weekday columns line up", () => {
    for (const grid of buildMonthGrids()) {
      expect(grid.cells.length % 7).toBe(0);
    }
  });

  // The mockup's grids are Monday-first. Jan 16 2027 is a Saturday, Feb 1 is a
  // Monday, Mar 15 is a Monday — pinning the column index catches the classic
  // bug where `new Date("2027-01-16").getDay()` shifts a day in a negative-UTC
  // timezone, which would silently misalign the entire calendar.
  it("aligns days to Monday-first weekday columns", () => {
    const [jan, feb, mar] = buildMonthGrids();

    const indexOf = (grid: (typeof jan)["cells"], iso: string) =>
      grid.findIndex((cell) => cell.kind === "day" && cell.date === iso);

    expect(indexOf(jan.cells, "2027-01-16") % 7).toBe(5); // Saturday
    expect(indexOf(jan.cells, "2027-01-17") % 7).toBe(6); // Sunday
    expect(indexOf(feb.cells, "2027-02-01") % 7).toBe(0); // Monday
    expect(indexOf(mar.cells, "2027-03-15") % 7).toBe(0); // Monday
  });

  it("renders out-of-window days as blank cells rather than dropping them", () => {
    const [jan, , mar] = buildMonthGrids();

    // Jan 1-15 and Mar 16-31 are outside the window on purpose. They stay as
    // blank cells so the weekday columns remain honest (PLAN.md section 7).
    const janDays = jan.cells.filter((c) => c.kind === "day");
    expect(janDays).toHaveLength(16); // Jan 16-31
    expect(jan.cells.some((c) => c.kind === "blank")).toBe(true);

    const marDays = mar.cells.filter((c) => c.kind === "day");
    expect(marDays).toHaveLength(15); // Mar 1-15
  });

  it("never emits a day cell for a date outside the window", () => {
    for (const grid of buildMonthGrids()) {
      for (const cell of grid.cells) {
        if (cell.kind === "day") expect(isInWindow(cell.date)).toBe(true);
      }
    }
  });
});

describe("blackout dates", () => {
  // PLAN.md section 16 decision 2: the Session Pass blackout hits Steamboat
  // AND Winter Park. Copper (Summit County) is blackout-free on every Ikon
  // tier — the mockup's "Steamboat only" legend is wrong.
  const inWindowBlackouts = ["2027-01-16", "2027-01-17", "2027-02-13", "2027-02-14"];

  it("blacks out the four in-window dates at Steamboat", () => {
    for (const date of inWindowBlackouts) {
      expect(isBlackoutDate(date, "steamboat")).toBe(true);
    }
  });

  it("blacks out the same four dates at Winter Park, not just Steamboat", () => {
    for (const date of inWindowBlackouts) {
      expect(isBlackoutDate(date, "winterPark")).toBe(true);
    }
  });

  it("blacks out nothing at Summit County", () => {
    for (const date of eachDateInWindow()) {
      expect(isBlackoutDate(date, "summitCounty")).toBe(false);
    }
  });

  it("leaves ordinary days selectable", () => {
    expect(isBlackoutDate("2027-01-30", "steamboat")).toBe(false);
    expect(isBlackoutDate("2027-02-15", "winterPark")).toBe(false);
  });

  it("marks blackout cells on the grid for the chosen destination only", () => {
    const steamboat = buildMonthGrids("steamboat").flatMap((g) =>
      g.cells.filter((c) => c.kind === "day" && c.isBlackout),
    );
    expect(steamboat).toHaveLength(4);

    const summit = buildMonthGrids("summitCounty").flatMap((g) =>
      g.cells.filter((c) => c.kind === "day" && c.isBlackout),
    );
    expect(summit).toHaveLength(0);
  });

  it("marks no blackouts when no destination has been chosen yet", () => {
    const none = buildMonthGrids().flatMap((g) =>
      g.cells.filter((c) => c.kind === "day" && c.isBlackout),
    );
    expect(none).toHaveLength(0);
  });
});

describe("datesInRange", () => {
  it("returns every date from start to end inclusive", () => {
    expect(datesInRange("2027-01-28", "2027-01-31")).toEqual([
      "2027-01-28",
      "2027-01-29",
      "2027-01-30",
      "2027-01-31",
    ]);
  });

  it("spans a month boundary without skipping or duplicating", () => {
    expect(datesInRange("2027-01-30", "2027-02-02")).toEqual([
      "2027-01-30",
      "2027-01-31",
      "2027-02-01",
      "2027-02-02",
    ]);
  });

  it("normalises a reversed range rather than returning nothing", () => {
    // Drag-painting a range backwards is a normal gesture, so the caller
    // shouldn't have to sort the endpoints first.
    expect(datesInRange("2027-01-31", "2027-01-28")).toEqual([
      "2027-01-28",
      "2027-01-29",
      "2027-01-30",
      "2027-01-31",
    ]);
  });

  it("returns a single date when start and end match", () => {
    expect(datesInRange("2027-02-01", "2027-02-01")).toEqual(["2027-02-01"]);
  });
});

describe("quick picks", () => {
  it("offers the three preset windows from the mockup", () => {
    expect(quickPicks).toHaveLength(3);
  });

  it("covers only dates inside the window", () => {
    for (const pick of quickPicks) {
      for (const date of pick.dates) {
        expect(isInWindow(date)).toBe(true);
      }
    }
  });

  it("spans the nights each preset advertises", () => {
    // A 3-night stay touches 4 calendar days.
    expect(quickPicks[0].dates).toEqual([
      "2027-01-28",
      "2027-01-29",
      "2027-01-30",
      "2027-01-31",
    ]);
    expect(quickPicks[1].dates.at(-1)).toBe("2027-02-01");
    expect(quickPicks[2].dates).toHaveLength(5); // 4 nights
  });
});
