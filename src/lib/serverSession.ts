import { cookies } from "next/headers";
import {
  getAvailability,
  getDestinationRanking,
  findRespondentByToken,
  findDeclineByToken,
} from "@/db/queries";
import type { Respondent, Decline } from "@/db/schema";
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
  /** Best first. Empty when this person hasn't ranked anything yet. */
  destinationRanking: DestinationSlug[];
  availability: { date: string; status: AvailabilityStatus }[];
};

export function toClientResponse(
  respondent: Respondent,
  destinationRanking: DestinationSlug[],
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
    destinationRanking,
    availability,
  };
}

/** Reads the identity cookie, returning it only if it's shaped like one we'd issue. */
export async function currentCookieToken(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(IDENTITY_COOKIE)?.value;
  return isValidCookieToken(token) ? token : null;
}

/** Reads the identity cookie and resolves it to a row, or null for a first visit. */
export async function currentRespondent(): Promise<Respondent | null> {
  const token = await currentCookieToken();
  if (!token) return null;
  return findRespondentByToken(token);
}

/**
 * `ClientDecline` deliberately carries only `name` — same reasoning as
 * `ClientResponse` above: nothing identifying leaves the server. `email` and
 * `reason` are Ben's to read in the database, not the client's to see echoed
 * back.
 */
export type ClientDecline = { name: string | null };

function toClientDecline(decline: Decline): ClientDecline {
  return { name: decline.name };
}

/** Mirrors currentRespondent. */
export async function currentDecline(): Promise<Decline | null> {
  const token = await currentCookieToken();
  if (!token) return null;
  return findDeclineByToken(token);
}

export async function loadClientResponse(
  respondent: Respondent,
): Promise<ClientResponse> {
  const [destinationRanking, availabilityRows] = await Promise.all([
    getDestinationRanking(respondent.id),
    getAvailability(respondent.id),
  ]);

  return toClientResponse(
    respondent,
    destinationRanking,
    availabilityRows.map((row) => ({ date: row.date, status: row.status })),
  );
}

/**
 * Resolves the identity cookie to a saved response for `/`, folding a
 * database outage into `failed` rather than letting it escape — any of the
 * lookups below can throw when Postgres is unreachable, and all of them mean
 * the same thing to the caller.
 *
 * The respondent and decline lookups run unconditionally, regardless of each
 * other's result — a row can exist on both sides at once (someone who
 * responded and later declined), so neither is allowed to short-circuit off
 * the other's outcome.
 */
export async function loadInitialResponse(): Promise<{
  response: ClientResponse | null;
  decline: ClientDecline | null;
  failed: boolean;
}> {
  try {
    const [respondent, decline] = await Promise.all([currentRespondent(), currentDecline()]);
    const response = respondent ? await loadClientResponse(respondent) : null;
    return { response, decline: decline ? toClientDecline(decline) : null, failed: false };
  } catch {
    return { response: null, decline: null, failed: true };
  }
}
