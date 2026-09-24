// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Respondent } from "@/db/schema";
import { POST } from "./route";

const mockFinishResponse = vi.fn();
const mockGetDestinationRanking = vi.fn();
const mockGetAvailability = vi.fn();
vi.mock("@/db/queries", () => ({
  finishResponse: (...args: unknown[]) => mockFinishResponse(...args),
  getDestinationRanking: (...args: unknown[]) => mockGetDestinationRanking(...args),
  getAvailability: (...args: unknown[]) => mockGetAvailability(...args),
}));

const mockCurrentRespondent = vi.fn();
const mockLoadClientResponse = vi.fn();
vi.mock("@/lib/serverSession", () => ({
  currentRespondent: () => mockCurrentRespondent(),
  loadClientResponse: (...args: unknown[]) => mockLoadClientResponse(...args),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  guestWriteLimit: async () => null,
}));

const RESPONDENT: Respondent = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cookieToken: "11111111-1111-4111-8111-111111111111",
  name: "Jamie",
  email: "jamie@example.com",
  plusOne: false,
  homeAirport: "ORD",
  skiLevel: "intermediate",
  skiDays: 2,
  alreadyHasPass: false,
  gearStatus: "rental",
  plusOneSkiDays: null,
  plusOneAlreadyHasPass: false,
  plusOneGearStatus: null,
  notes: null,
  submittedAt: null,
  createdAt: new Date("2027-01-01T00:00:00Z"),
  updatedAt: new Date("2027-01-01T00:00:00Z"),
};

function finish() {
  return POST(new Request("http://localhost/api/respondents/finish", { method: "POST" }));
}

describe("POST /api/respondents/finish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentRespondent.mockResolvedValue(RESPONDENT);
    mockGetDestinationRanking.mockResolvedValue(["vail"]);
    mockGetAvailability.mockResolvedValue([{ date: "2027-01-28", status: "available" }]);
    mockLoadClientResponse.mockResolvedValue({ name: "Jamie" });
  });

  it("finishing clears the decline and marks submitted in one call", async () => {
    const submitted = { ...RESPONDENT, submittedAt: new Date() };
    mockFinishResponse.mockResolvedValue(submitted);

    const response = await finish();

    expect(response.status).toBe(200);
    expect(mockFinishResponse).toHaveBeenCalledTimes(1);
    expect(mockFinishResponse).toHaveBeenCalledWith(RESPONDENT);
    expect(mockLoadClientResponse).toHaveBeenCalledWith(submitted);
  });

  it("a 422 leaves the decline alone", async () => {
    mockGetDestinationRanking.mockResolvedValue([]);

    const response = await finish();

    expect(response.status).toBe(422);
    expect(mockFinishResponse).not.toHaveBeenCalled();
  });
});
