import { describe, expect, it } from "vitest";
import { finishProblems } from "./finish";
import type { Respondent } from "@/db/schema";

function respondent(overrides: Partial<Respondent> = {}): Respondent {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    cookieToken: "00000000-0000-4000-8000-000000000001",
    name: "Jamie Rivera",
    email: "jamie@example.com",
    plusOne: false,
    homeAirport: "SFO",
    skiLevel: "intermediate",
    skiDays: 2,
    alreadyHasPass: false,
    gearStatus: "rental",
    plusOneSkiDays: null,
    plusOneAlreadyHasPass: false,
    plusOneGearStatus: null,
    notes: null,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const complete = {
  destinationSlug: "summitCounty" as const,
  availableDayCount: 4,
};

const fieldsOf = (problems: { field: string }[]) => problems.map((p) => p.field);

describe("finishProblems", () => {
  it("finds nothing wrong with a complete response", () => {
    expect(finishProblems(respondent(), complete)).toEqual([]);
  });

  it("asks for a destination preference when none is chosen", () => {
    const problems = finishProblems(respondent(), {
      ...complete,
      destinationSlug: null,
    });
    expect(fieldsOf(problems)).toContain("destinationSlug");
  });

  it("asks for at least one day when the calendar is untouched", () => {
    const problems = finishProblems(respondent(), { ...complete, availableDayCount: 0 });
    expect(fieldsOf(problems)).toContain("availability");
  });

  it("asks for ski days when the person hasn't said and has no pass", () => {
    const problems = finishProblems(
      respondent({ skiDays: null, alreadyHasPass: false }),
      complete,
    );
    expect(fieldsOf(problems)).toContain("skiDays");
  });

  it("accepts a pass holder with no ski days, since that's how it's stored", () => {
    const problems = finishProblems(
      respondent({ skiDays: null, alreadyHasPass: true }),
      complete,
    );
    expect(fieldsOf(problems)).not.toContain("skiDays");
  });

  it("asks about gear when the question is unanswered", () => {
    const problems = finishProblems(respondent({ gearStatus: null }), complete);
    expect(fieldsOf(problems)).toContain("gearStatus");
  });

  describe("with a plus-one", () => {
    const withPlusOne = (overrides: Partial<Respondent> = {}) =>
      respondent({
        plusOne: true,
        plusOneSkiDays: 2,
        plusOneGearStatus: "own",
        ...overrides,
      });

    it("accepts a fully answered plus-one", () => {
      expect(finishProblems(withPlusOne(), complete)).toEqual([]);
    });

    it("asks for the plus-one's ski days", () => {
      const problems = finishProblems(
        withPlusOne({ plusOneSkiDays: null, plusOneAlreadyHasPass: false }),
        complete,
      );
      expect(fieldsOf(problems)).toContain("plusOneSkiDays");
    });

    it("asks for the plus-one's gear", () => {
      const problems = finishProblems(withPlusOne({ plusOneGearStatus: null }), complete);
      expect(fieldsOf(problems)).toContain("plusOneGearStatus");
    });

    it("accepts a plus-one who already holds a pass", () => {
      const problems = finishProblems(
        withPlusOne({ plusOneSkiDays: null, plusOneAlreadyHasPass: true }),
        complete,
      );
      expect(fieldsOf(problems)).not.toContain("plusOneSkiDays");
    });
  });

  it("ignores plus-one answers entirely when the person is coming solo", () => {
    // A solo respondent may still have stale plus-one values from before they
    // switched the toggle. Those must not block them from finishing.
    const problems = finishProblems(
      respondent({ plusOne: false, plusOneSkiDays: null, plusOneGearStatus: null }),
      complete,
    );
    expect(fieldsOf(problems)).not.toContain("plusOneSkiDays");
    expect(fieldsOf(problems)).not.toContain("plusOneGearStatus");
  });

  it("reports every problem at once rather than one at a time", () => {
    const problems = finishProblems(
      respondent({ skiDays: null, gearStatus: null, plusOne: true }),
      { destinationSlug: null, availableDayCount: 0 },
    );
    expect(fieldsOf(problems).sort()).toEqual(
      [
        "availability",
        "destinationSlug",
        "gearStatus",
        "plusOneGearStatus",
        "plusOneSkiDays",
        "skiDays",
      ].sort(),
    );
  });

  it("gives every problem a message worth showing a person", () => {
    const problems = finishProblems(respondent({ skiDays: null, gearStatus: null }), {
      destinationSlug: null,
      availableDayCount: 0,
    });
    for (const problem of problems) {
      expect(problem.message.length).toBeGreaterThan(0);
    }
  });
});
