import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Respondent } from "@/db/schema";
import { loadInitialResponse } from "./serverSession";

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockFindRespondentByToken = vi.fn();
const mockGetDestinationRanking = vi.fn();
const mockGetAvailability = vi.fn();
vi.mock("@/db/queries", () => ({
  findRespondentByToken: (...args: unknown[]) => mockFindRespondentByToken(...args),
  getDestinationRanking: (...args: unknown[]) => mockGetDestinationRanking(...args),
  getAvailability: (...args: unknown[]) => mockGetAvailability(...args),
}));

const VALID_TOKEN = "11111111-1111-4111-8111-111111111111";

const RESPONDENT: Respondent = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cookieToken: VALID_TOKEN,
  name: "Ben",
  email: "ben@example.com",
  plusOne: false,
  homeAirport: "ORD",
  skiLevel: "intermediate",
  skiDays: 3,
  alreadyHasPass: false,
  gearStatus: "own",
  plusOneSkiDays: null,
  plusOneAlreadyHasPass: false,
  plusOneGearStatus: null,
  notes: null,
  submittedAt: null,
  createdAt: new Date("2027-01-01T00:00:00Z"),
  updatedAt: new Date("2027-01-01T00:00:00Z"),
};

function mockCookieValue(value: string | undefined) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === "ski_trip_token" && value ? { value } : undefined),
  });
}

describe("loadInitialResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports failed when the respondent lookup throws", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockRejectedValue(new Error("connection refused"));

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, failed: true });
  });

  // The lookup and the response load are two separate DB round-trips inside
  // one try/catch; this covers the second one throwing after the first
  // succeeds, which a refactor that split them apart could silently break.
  it("reports failed when the response load throws after a successful lookup", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(RESPONDENT);
    mockGetDestinationRanking.mockRejectedValue(new Error("connection refused"));
    mockGetAvailability.mockResolvedValue([]);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, failed: true });
  });

  it("resolves the saved response for a valid cookie", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(RESPONDENT);
    mockGetDestinationRanking.mockResolvedValue(["steamboat"]);
    mockGetAvailability.mockResolvedValue([
      { respondentId: RESPONDENT.id, date: "2027-01-20", status: "available" },
    ]);

    const result = await loadInitialResponse();

    expect(result.failed).toBe(false);
    expect(result.response).toEqual({
      name: "Ben",
      email: "ben@example.com",
      plusOne: false,
      homeAirport: "ORD",
      skiLevel: "intermediate",
      skiDays: 3,
      alreadyHasPass: false,
      gearStatus: "own",
      plusOneSkiDays: null,
      plusOneAlreadyHasPass: false,
      plusOneGearStatus: null,
      notes: null,
      submittedAt: null,
      destinationRanking: ["steamboat"],
      availability: [{ date: "2027-01-20", status: "available" }],
    });
  });

  it("returns no response and no failure when there's no cookie", async () => {
    mockCookieValue(undefined);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, failed: false });
    expect(mockFindRespondentByToken).not.toHaveBeenCalled();
  });
});
