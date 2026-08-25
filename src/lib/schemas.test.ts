import { describe, expect, it } from "vitest";
import {
  availabilityBulkSchema,
  intakeSchema,
  respondentPatchSchema,
} from "./schemas";

const validIntake = {
  name: "Jamie Rivera",
  email: "jamie@example.com",
  plusOne: true,
  homeAirport: "SFO",
  skiLevel: "intermediate",
};

describe("intakeSchema", () => {
  it("accepts a complete intake", () => {
    expect(intakeSchema.safeParse(validIntake).success).toBe(true);
  });

  // Section 16 decision 7: nothing is written until all five fields are in,
  // so every one of them is required here rather than merely encouraged.
  it.each(["name", "email", "plusOne", "homeAirport", "skiLevel"])(
    "rejects intake missing %s",
    (field) => {
      const partial = { ...validIntake };
      delete partial[field as keyof typeof partial];
      expect(intakeSchema.safeParse(partial).success).toBe(false);
    },
  );

  it("rejects a malformed email", () => {
    expect(intakeSchema.safeParse({ ...validIntake, email: "jamie" }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...validIntake, email: "" }).success).toBe(false);
  });

  it("rejects a name that is blank or only whitespace", () => {
    expect(intakeSchema.safeParse({ ...validIntake, name: "" }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...validIntake, name: "   " }).success).toBe(false);
  });

  it("trims surrounding whitespace off the name", () => {
    const parsed = intakeSchema.parse({ ...validIntake, name: "  Jamie Rivera  " });
    expect(parsed.name).toBe("Jamie Rivera");
  });

  // Section 16 decision 4 dropped 'OTHER' from the airport list; MSP was
  // added later, after the original four-airport list turned out to be missing
  // someone.
  it("accepts the four home airports in the group", () => {
    for (const code of ["SFO", "ORD", "MKE", "MSP"]) {
      expect(intakeSchema.safeParse({ ...validIntake, homeAirport: code }).success).toBe(
        true,
      );
    }
    for (const code of ["OTHER", "DEN", "sfo", "msp", ""]) {
      expect(intakeSchema.safeParse({ ...validIntake, homeAirport: code }).success).toBe(
        false,
      );
    }
  });

  it("rejects an unrecognised ski level", () => {
    expect(intakeSchema.safeParse({ ...validIntake, skiLevel: "expert" }).success).toBe(
      false,
    );
  });
});

describe("respondentPatchSchema", () => {
  it("accepts a partial body, since autosave sends only what changed", () => {
    expect(respondentPatchSchema.safeParse({ notes: "running late" }).success).toBe(true);
    expect(respondentPatchSchema.safeParse({}).success).toBe(true);
  });

  it("still validates the fields that are present", () => {
    expect(respondentPatchSchema.safeParse({ gearStatus: "borrowed" }).success).toBe(
      false,
    );
    expect(respondentPatchSchema.safeParse({ homeAirport: "OTHER" }).success).toBe(false);
    expect(respondentPatchSchema.safeParse({ gearStatus: "rental" }).success).toBe(true);
  });

  // Anyone with the link can hit this endpoint (PLAN.md section 14), so the
  // body must not be able to reach columns the form doesn't own. Rejecting
  // unknown keys outright is what stops a caller marking themselves submitted
  // or, worse, rebinding the cookie token to another person's row.
  it.each(["id", "cookieToken", "submittedAt", "createdAt", "updatedAt"])(
    "rejects a body trying to set %s",
    (field) => {
      expect(
        respondentPatchSchema.safeParse({ notes: "hi", [field]: "anything" }).success,
      ).toBe(false);
    },
  );

  it("accepts ski days of 1, 2 or 3 and nothing else", () => {
    for (const days of [1, 2, 3]) {
      expect(respondentPatchSchema.safeParse({ skiDays: days }).success).toBe(true);
    }
    for (const days of [0, 4, -1, 2.5, "2"]) {
      expect(respondentPatchSchema.safeParse({ skiDays: days }).success).toBe(false);
    }
  });

  it("accepts null ski days, which is how a pass holder is stored", () => {
    expect(respondentPatchSchema.safeParse({ skiDays: null }).success).toBe(true);
    expect(respondentPatchSchema.safeParse({ plusOneSkiDays: null }).success).toBe(true);
  });

  it("accepts the plus-one's fields independently of the respondent's", () => {
    const parsed = respondentPatchSchema.parse({
      skiDays: 3,
      gearStatus: "own",
      plusOneSkiDays: 1,
      plusOneGearStatus: "rental",
    });
    expect(parsed.skiDays).toBe(3);
    expect(parsed.plusOneSkiDays).toBe(1);
  });

  it("caps notes so a single field can't be used to dump unbounded text", () => {
    expect(respondentPatchSchema.safeParse({ notes: "x".repeat(2000) }).success).toBe(
      true,
    );
    expect(respondentPatchSchema.safeParse({ notes: "x".repeat(2001) }).success).toBe(
      false,
    );
  });

  it("accepts a full ranking of every destination", () => {
    expect(
      respondentPatchSchema.safeParse({
        destinationRanking: ["winterPark", "steamboat", "summitCounty"],
      }).success,
    ).toBe(true);
  });

  it("accepts a null ranking, which is how a ranking is taken back", () => {
    expect(respondentPatchSchema.safeParse({ destinationRanking: null }).success).toBe(
      true,
    );
  });

  // A partial ranking would leave it ambiguous whether an absent destination
  // was ranked last or simply not considered.
  it("rejects a ranking that omits a destination", () => {
    expect(
      respondentPatchSchema.safeParse({ destinationRanking: ["steamboat"] }).success,
    ).toBe(false);
    expect(
      respondentPatchSchema.safeParse({
        destinationRanking: ["steamboat", "winterPark"],
      }).success,
    ).toBe(false);
  });

  it("rejects a ranking with the same destination twice", () => {
    expect(
      respondentPatchSchema.safeParse({
        destinationRanking: ["steamboat", "steamboat", "winterPark"],
      }).success,
    ).toBe(false);
  });

  it("rejects a ranking containing an unknown destination", () => {
    expect(
      respondentPatchSchema.safeParse({
        destinationRanking: ["steamboat", "winterPark", "vail"],
      }).success,
    ).toBe(false);
  });
});

describe("availabilityBulkSchema", () => {
  it("accepts day statuses inside the window", () => {
    const result = availabilityBulkSchema.safeParse({
      entries: [
        { date: "2027-01-28", status: "available" },
        { date: "2027-02-13", status: "maybe" },
        { date: "2027-03-15", status: "unavailable" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty set, which is how a person clears their answer", () => {
    expect(availabilityBulkSchema.safeParse({ entries: [] }).success).toBe(true);
  });

  it("rejects dates outside the Jan 16 - Mar 15 window", () => {
    for (const date of ["2027-01-15", "2027-03-16", "2026-12-27", "2027-07-04"]) {
      expect(
        availabilityBulkSchema.safeParse({ entries: [{ date, status: "available" }] })
          .success,
      ).toBe(false);
    }
  });

  it("rejects malformed dates rather than coercing them", () => {
    for (const date of ["2027-1-28", "01/28/2027", "not-a-date", ""]) {
      expect(
        availabilityBulkSchema.safeParse({ entries: [{ date, status: "available" }] })
          .success,
      ).toBe(false);
    }
  });

  it("rejects an unrecognised status", () => {
    expect(
      availabilityBulkSchema.safeParse({
        entries: [{ date: "2027-01-28", status: "probably" }],
      }).success,
    ).toBe(false);
  });

  it("rejects more entries than there are days in the window", () => {
    const entries = Array.from({ length: 60 }, () => ({
      date: "2027-01-28",
      status: "available" as const,
    }));
    expect(availabilityBulkSchema.safeParse({ entries }).success).toBe(false);
  });
});
