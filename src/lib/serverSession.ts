import { cookies } from "next/headers";
import { getAvailability, getDestinationVote, findRespondentByToken } from "@/db/queries";
import type { Respondent } from "@/db/schema";
import type { DestinationSlug } from "@/data/types";
import type { AvailabilityStatus } from "@/db/schema";
import { IDENTITY_COOKIE, isValidCookieToken } from "./session";

/**
 * The whole of a guest's saved answer, as the page and the API both need it.
 * Note what's absent: `id` and `cookieToken` never leave the server. The
 * token is the only thing standing in for identity, so echoing it into a JSON
 * body — where any script on the page could read it — would undo the point of
 * marking the cookie httpOnly.
 */
export type ClientResponse = {
  name: string;
  email: string;
  plusOne: boolean;
  homeAirport: Respondent["homeAirport"];
  skiLevel: Respondent["skiLevel"];
  skiDays: Respondent["skiDays"];
  alreadyHasPass: boolean;
  gearStatus: Respondent["gearStatus"];
  plusOneSkiDays: Respondent["plusOneSkiDays"];
  plusOneAlreadyHasPass: boolean;
  plusOneGearStatus: Respondent["plusOneGearStatus"];
  notes: string | null;
  submittedAt: string | null;
  destinationSlug: DestinationSlug | null;
  availability: { date: string; status: AvailabilityStatus }[];
};

export function toClientResponse(
  respondent: Respondent,
  destinationSlug: DestinationSlug | null,
  availability: { date: string; status: AvailabilityStatus }[],
): ClientResponse {
  return {
    name: respondent.name,
    email: respondent.email,
    plusOne: respondent.plusOne,
    homeAirport: respondent.homeAirport,
    skiLevel: respondent.skiLevel,
    skiDays: respondent.skiDays,
    alreadyHasPass: respondent.alreadyHasPass,
    gearStatus: respondent.gearStatus,
    plusOneSkiDays: respondent.plusOneSkiDays,
    plusOneAlreadyHasPass: respondent.plusOneAlreadyHasPass,
    plusOneGearStatus: respondent.plusOneGearStatus,
    notes: respondent.notes,
    submittedAt: respondent.submittedAt?.toISOString() ?? null,
    destinationSlug,
    availability,
  };
}

/** Reads the identity cookie and resolves it to a row, or null for a first visit. */
export async function currentRespondent(): Promise<Respondent | null> {
  const store = await cookies();
  const token = store.get(IDENTITY_COOKIE)?.value;
  if (!isValidCookieToken(token)) return null;
  return findRespondentByToken(token);
}

export async function loadClientResponse(
  respondent: Respondent,
): Promise<ClientResponse> {
  const [destinationSlug, availabilityRows] = await Promise.all([
    getDestinationVote(respondent.id),
    getAvailability(respondent.id),
  ]);

  return toClientResponse(
    respondent,
    destinationSlug,
    availabilityRows.map((row) => ({ date: row.date, status: row.status })),
  );
}
