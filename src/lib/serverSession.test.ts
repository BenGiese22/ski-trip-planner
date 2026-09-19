import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Decline, Respondent } from "@/db/schema";
import { loadInitialResponse } from "./serverSession";

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockFindRespondentByToken = vi.fn();
const mockFindDeclineByToken = vi.fn();
const mockGetDestinationRanking = vi.fn();
const mockGetAvailability = vi.fn();
vi.mock("@/db/queries", () => ({
  findRespondentByToken: (...args: unknown[]) => mockFindRespondentByToken(...args),
  findDeclineByToken: (...args: unknown[]) => mockFindDeclineByToken(...args),
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

const DECLINE: Decline = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cookieToken: VALID_TOKEN,
  name: "Jamie",
  email: "jamie@example.com",
  reason: "Can't make it this year",
  createdAt: new Date("2027-01-01T00:00:00Z"),
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
    mockFindDeclineByToken.mockResolvedValue(null);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, decline: null, failed: true });
  });

  it("reports failed when the decline lookup throws", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(null);
    mockFindDeclineByToken.mockRejectedValue(new Error("connection refused"));

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, decline: null, failed: true });
  });

  // The lookup and the response load are two separate DB round-trips inside
  // one try/catch; this covers the second one throwing after the first
  // succeeds, which a refactor that split them apart could silently break.
  it("reports failed when the response load throws after a successful lookup", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(RESPONDENT);
    mockFindDeclineByToken.mockResolvedValue(null);
    mockGetDestinationRanking.mockRejectedValue(new Error("connection refused"));
    mockGetAvailability.mockResolvedValue([]);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, decline: null, failed: true });
  });

  it("resolves the saved response for a valid cookie, with no decline", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(RESPONDENT);
    mockFindDeclineByToken.mockResolvedValue(null);
    mockGetDestinationRanking.mockResolvedValue(["steamboat"]);
    mockGetAvailability.mockResolvedValue([
      { respondentId: RESPONDENT.id, date: "2027-01-20", status: "available" },
    ]);

    const result = await loadInitialResponse();

    expect(result.failed).toBe(false);
    expect(result.decline).toBeNull();
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
    // Both lookups run unconditionally, regardless of each other's result.
    expect(mockFindRespondentByToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(mockFindDeclineByToken).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("resolves a decline for a valid cookie, with no respondent", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(null);
    mockFindDeclineByToken.mockResolvedValue(DECLINE);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, decline: { name: "Jamie" }, failed: false });
    expect(mockFindRespondentByToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(mockFindDeclineByToken).toHaveBeenCalledWith(VALID_TOKEN);
  });

  it("resolves both a response and a decline when both rows exist", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(RESPONDENT);
    mockFindDeclineByToken.mockResolvedValue(DECLINE);
    mockGetDestinationRanking.mockResolvedValue([]);
    mockGetAvailability.mockResolvedValue([]);

    const result = await loadInitialResponse();

    expect(result.failed).toBe(false);
    expect(result.response).not.toBeNull();
    expect(result.response?.name).toBe("Ben");
    expect(result.decline).toEqual({ name: "Jamie" });
  });

  it("resolves neither a response nor a decline when the cookie matches nothing", async () => {
    mockCookieValue(VALID_TOKEN);
    mockFindRespondentByToken.mockResolvedValue(null);
    mockFindDeclineByToken.mockResolvedValue(null);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, decline: null, failed: false });
  });

  it("returns no response and no failure when there's no cookie", async () => {
    mockCookieValue(undefined);

    const result = await loadInitialResponse();

    expect(result).toEqual({ response: null, decline: null, failed: false });
    expect(mockFindRespondentByToken).not.toHaveBeenCalled();
    expect(mockFindDeclineByToken).not.toHaveBeenCalled();
  });
});
