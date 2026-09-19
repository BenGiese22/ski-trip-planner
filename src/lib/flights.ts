const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return SHORT_DATE.format(new Date(Date.UTC(y, m - 1, d)));
}

export type FlightDateRange = { start: string; end: string };

/**
 * Google Flights' `q` param is a natural-language search box, not a
 * structured API — appending a plain-English date phrase is the whole
 * mechanism for pre-filling dates, no query-param schema to match.
 */
export function googleFlightsUrl(
  origin: string,
  destination: string,
  dateRange?: FlightDateRange,
): string {
  let dates = "";
  if (dateRange) {
    dates =
      dateRange.start === dateRange.end
        ? ` on ${formatShortDate(dateRange.start)}`
        : ` from ${formatShortDate(dateRange.start)} to ${formatShortDate(dateRange.end)}`;
  }
  const query = `Flights from ${origin} to ${destination}${dates}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
