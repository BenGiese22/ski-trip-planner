export function googleFlightsUrl(origin: string, destination: string): string {
  const query = `Flights from ${origin} to ${destination}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
