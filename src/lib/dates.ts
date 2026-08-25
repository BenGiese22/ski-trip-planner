import { passInfo } from "@/data/passInfo";
import type { DestinationSlug } from "@/data/types";

/**
 * Mid-January through mid-March 2027. Ben narrowed the range deliberately —
 * snow is typically most reliable in this stretch (PLAN.md section 7).
 */
export const WINDOW_START = "2027-01-16";
export const WINDOW_END = "2027-03-15";

const DAY_MS = 86_400_000;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// All date maths runs in UTC. Going through local time would make
// `getDay()` return the previous day west of Greenwich, which silently shifts
// every weekday column in the calendar.
function toUtcMs(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday, matching the mockup's Monday-first grids. */
function mondayFirstColumn(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

export function isInWindow(date: string): boolean {
  const ms = toUtcMs(date);
  return ms >= toUtcMs(WINDOW_START) && ms <= toUtcMs(WINDOW_END);
}

/** Inclusive of both endpoints, and tolerant of them arriving reversed. */
export function datesInRange(start: string, end: string): string[] {
  const from = Math.min(toUtcMs(start), toUtcMs(end));
  const to = Math.max(toUtcMs(start), toUtcMs(end));

  const dates: string[] = [];
  for (let ms = from; ms <= to; ms += DAY_MS) {
    dates.push(toIso(ms));
  }
  return dates;
}

export function eachDateInWindow(): string[] {
  return datesInRange(WINDOW_START, WINDOW_END);
}

export function isBlackoutDate(date: string, destinationSlug: DestinationSlug): boolean {
  const blackouts: readonly string[] = passInfo.sessionPassBlackoutDates[destinationSlug];
  return blackouts.includes(date);
}

export type DayCell =
  | { kind: "blank" }
  | { kind: "day"; date: string; dayOfMonth: number; isBlackout: boolean };

export type MonthGrid = {
  label: string;
  year: number;
  month: number;
  cells: DayCell[];
};

const BLANK: DayCell = { kind: "blank" };

function monthsSpanned(): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const [startYear, startMonth] = WINDOW_START.split("-").map(Number);
  const [endYear, endMonth] = WINDOW_END.split("-").map(Number);

  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return months;
}

/**
 * One grid per month the window touches. Days outside the window keep their
 * slot as a blank cell rather than being dropped — that holds the weekday
 * columns honest without inviting a click on a day that was never on the
 * table (PLAN.md section 7).
 *
 * Blackout marking is per destination: pass the respondent's chosen
 * destination to have its blackout days flagged, or omit it before a choice
 * has been made, when nothing is decided enough to grey out.
 */
export function buildMonthGrids(destinationSlug?: DestinationSlug): MonthGrid[] {
  return monthsSpanned().map(({ year, month }) => {
    const firstOfMonth = Date.UTC(year, month - 1, 1);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells: DayCell[] = Array.from<DayCell>({
      length: mondayFirstColumn(firstOfMonth),
    }).fill(BLANK);

    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
      const date = toIso(Date.UTC(year, month - 1, dayOfMonth));
      cells.push(
        isInWindow(date)
          ? {
              kind: "day",
              date,
              dayOfMonth,
              isBlackout: destinationSlug ? isBlackoutDate(date, destinationSlug) : false,
            }
          : BLANK,
      );
    }

    while (cells.length % 7 !== 0) cells.push(BLANK);

    return { label: `${MONTH_NAMES[month - 1]} ${year}`, year, month, cells };
  });
}

export type QuickPick = {
  label: string;
  note: string;
  dates: string[];
};

/**
 * The fast path most people will use instead of touching the grid. Kept as
 * whole stays (a 3-night stay touches 4 calendar days) so selecting one paints
 * a contiguous block.
 */
export const quickPicks: QuickPick[] = [
  {
    label: "Thu Jan 28 – Sun Jan 31",
    note: "3 nights",
    dates: datesInRange("2027-01-28", "2027-01-31"),
  },
  {
    label: "Fri Jan 29 – Mon Feb 1",
    note: "3 nights, ski on the birthday",
    dates: datesInRange("2027-01-29", "2027-02-01"),
  },
  {
    label: "Sat Jan 30 – Wed Feb 3",
    note: "4 nights, lighter midweek crowds",
    dates: datesInRange("2027-01-30", "2027-02-03"),
  },
];
