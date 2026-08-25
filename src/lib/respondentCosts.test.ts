import { describe, expect, it } from "vitest";
import { PASS_HOLDER_ASSUMED_SKI_DAYS, respondentCostBreakdown } from "./respondentCosts";
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

const labelsOf = (lines: { label: string }[]) => lines.map((l) => l.label);

describe("respondentCostBreakdown", () => {
  it("returns a single person when there's no plus-one", () => {
    const result = respondentCostBreakdown(respondent(), "summitCounty");
    expect(result.people).toHaveLength(1);
    expect(result.people[0].label).toBe("You");
  });

  it("returns both people when a plus-one is coming", () => {
    const result = respondentCostBreakdown(
      respondent({ plusOne: true, plusOneSkiDays: 2, plusOneGearStatus: "own" }),
      "summitCounty",
    );
    expect(result.people).toHaveLength(2);
    expect(result.people[1].label).toBe("Your plus-one");
  });

  // Section 8: one guest's days and their plus-one's are frequently
  // different, and a shared input would misprice half the group.
  it("prices each person off their own ski days and gear", () => {
    const result = respondentCostBreakdown(
      respondent({
        skiDays: 3,
        gearStatus: "rental",
        plusOne: true,
        plusOneSkiDays: 2,
        plusOneGearStatus: "own",
      }),
      "winterPark",
    );

    const [you, partner] = result.people;
    expect(labelsOf(you.estimate.lineItems)).toContain("3-day Ikon Session Pass");
    expect(labelsOf(partner.estimate.lineItems)).toContain("2-day Ikon Session Pass");

    expect(labelsOf(you.estimate.lineItems).some((l) => /rental/i.test(l))).toBe(true);
    expect(labelsOf(partner.estimate.lineItems).some((l) => /rental/i.test(l))).toBe(
      false,
    );
  });

  it("omits the rental line entirely for someone bringing their own gear", () => {
    const result = respondentCostBreakdown(
      respondent({ gearStatus: "own" }),
      "steamboat",
    );
    expect(labelsOf(result.people[0].estimate.lineItems).some((l) => /rental/i.test(l))).toBe(
      false,
    );
  });

  it("totals the group across both people", () => {
    const result = respondentCostBreakdown(
      respondent({ plusOne: true, plusOneSkiDays: 2, plusOneGearStatus: "rental" }),
      "summitCounty",
    );

    const summed: [number, number] = result.people.reduce<[number, number]>(
      (acc, p) => [acc[0] + p.estimate.total[0], acc[1] + p.estimate.total[1]],
      [0, 0],
    );
    expect(result.total).toEqual(summed);
  });

  it("uses the chosen destination's lodging and the stated home airport", () => {
    const result = respondentCostBreakdown(respondent({ homeAirport: "ORD" }), "steamboat");
    const labels = labelsOf(result.people[0].estimate.lineItems);
    expect(labels).toContain("Flight, round trip (ORD)");
  });
});

describe("pass holders", () => {
  // Section 16 decision 6: already_has_pass means ski_days is null, so the
  // rental line has nothing to scale off. It assumes 2 days, and that
  // assumption has to be visible rather than silently baked in.
  it("drops the pass line for someone who already holds a pass", () => {
    const result = respondentCostBreakdown(
      respondent({ alreadyHasPass: true, skiDays: null, gearStatus: "own" }),
      "summitCounty",
    );

    const labels = labelsOf(result.people[0].estimate.lineItems);
    expect(labels.some((l) => /session pass|lift ticket/i.test(l))).toBe(false);
  });

  it("still charges rental, scaled at the assumed 2 days", () => {
    const passHolder = respondentCostBreakdown(
      respondent({ alreadyHasPass: true, skiDays: null, gearStatus: "rental" }),
      "summitCounty",
    );
    const twoDayRenter = respondentCostBreakdown(
      respondent({ skiDays: 2, gearStatus: "rental" }),
      "summitCounty",
    );

    const rentalOf = (r: typeof passHolder) =>
      r.people[0].estimate.lineItems.find((l) => /rental/i.test(l.label))?.range;

    expect(PASS_HOLDER_ASSUMED_SKI_DAYS).toBe(2);
    expect(rentalOf(passHolder)).toEqual(rentalOf(twoDayRenter));
  });

  it("flags the assumption so the UI can caption it", () => {
    const result = respondentCostBreakdown(
      respondent({ alreadyHasPass: true, skiDays: null, gearStatus: "rental" }),
      "summitCounty",
    );
    expect(result.people[0].assumedSkiDays).toBe(true);
  });

  it("does not flag an assumption when the person stated their ski days", () => {
    const result = respondentCostBreakdown(
      respondent({ skiDays: 2, gearStatus: "rental" }),
      "summitCounty",
    );
    expect(result.people[0].assumedSkiDays).toBe(false);
  });

  it("raises no assumption for a pass holder who owns their gear", () => {
    // Nothing scales off ski days for this person, so there's nothing to
    // assume and nothing to caption.
    const result = respondentCostBreakdown(
      respondent({ alreadyHasPass: true, skiDays: null, gearStatus: "own" }),
      "summitCounty",
    );
    expect(result.people[0].assumedSkiDays).toBe(false);
  });

  it("handles a plus-one who holds a pass independently of the respondent", () => {
    const result = respondentCostBreakdown(
      respondent({
        skiDays: 3,
        gearStatus: "rental",
        plusOne: true,
        plusOneAlreadyHasPass: true,
        plusOneSkiDays: null,
        plusOneGearStatus: "own",
      }),
      "winterPark",
    );

    const [you, partner] = result.people;
    expect(labelsOf(you.estimate.lineItems)).toContain("3-day Ikon Session Pass");
    expect(labelsOf(partner.estimate.lineItems).some((l) => /pass|ticket/i.test(l))).toBe(
      false,
    );
    expect(partner.assumedSkiDays).toBe(false);
  });
});

describe("incomplete answers", () => {
  it("falls back to a default ski-days figure when the person hasn't said yet", () => {
    // Autosave means half-filled rows are normal (section 6). The breakdown
    // still has to render something rather than throwing.
    const result = respondentCostBreakdown(
      respondent({ skiDays: null, alreadyHasPass: false, gearStatus: null }),
      "summitCounty",
    );
    expect(result.people).toHaveLength(1);
    expect(result.people[0].assumedSkiDays).toBe(true);
  });

  it("treats an unanswered gear question as no rental line", () => {
    const result = respondentCostBreakdown(
      respondent({ gearStatus: null }),
      "summitCounty",
    );
    expect(
      labelsOf(result.people[0].estimate.lineItems).some((l) => /rental/i.test(l)),
    ).toBe(false);
  });
});
