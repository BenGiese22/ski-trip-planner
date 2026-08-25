import { z } from "zod";
import { eachDateInWindow, isInWindow } from "./dates";

export const airportCodeSchema = z.enum(["SFO", "ORD", "MKE", "MSP"], {
  message: "Pick the airport you'd fly from",
});
export const skiLevelSchema = z.enum(["beginner", "intermediate", "advanced"], {
  message: "Let us know roughly how comfortable you are on snow",
});
export const gearStatusSchema = z.enum(["own", "rental"]);
export const destinationSlugSchema = z.enum(["steamboat", "summitCounty", "winterPark"]);
export const availabilityStatusSchema = z.enum(["available", "maybe", "unavailable"]);

/** 1, 2 or 3 — this group isn't buying a 4-day (PLAN.md section 8). */
export const skiDaysSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const nameSchema = z.string().trim().min(1, "Please tell us your name").max(120);
const emailSchema = z.email("That doesn't look like an email address").max(254);

/**
 * Everything needed before a respondent row exists at all (section 16,
 * decision 7). Email is required, not optional — decision 8.
 */
export const intakeSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  plusOne: z.boolean(),
  homeAirport: airportCodeSchema,
  skiLevel: skiLevelSchema,
});

export type IntakeInput = z.infer<typeof intakeSchema>;

/**
 * The autosave body. Every field is optional because autosave sends whatever
 * just changed, and an incomplete row is fine to have sitting in the database
 * mid-session (section 6) — full validation happens at "Save & finish".
 *
 * Strict, though: unknown keys are rejected rather than ignored. Anyone with
 * the link can call this endpoint, and the columns the form doesn't own —
 * `id`, `cookieToken`, `submittedAt` — must stay unreachable from a request
 * body. Ignoring unknown keys would silently accept such a payload; rejecting
 * it makes the attempt visible.
 */
export const respondentPatchSchema = z
  .strictObject({
    name: nameSchema,
    email: emailSchema,
    plusOne: z.boolean(),
    homeAirport: airportCodeSchema,
    skiLevel: skiLevelSchema,

    skiDays: skiDaysSchema.nullable(),
    alreadyHasPass: z.boolean(),
    gearStatus: gearStatusSchema,

    plusOneSkiDays: skiDaysSchema.nullable(),
    plusOneAlreadyHasPass: z.boolean(),
    plusOneGearStatus: gearStatusSchema,

    notes: z.string().max(2000),
    // Nullable so a pick can be taken back, not only changed.
    destinationSlug: destinationSlugSchema.nullable(),
  })
  .partial();

export type RespondentPatch = z.infer<typeof respondentPatchSchema>;

/**
 * An ISO date that actually falls in the trip window. Bounding this
 * server-side keeps junk rows out of the availability table — the grid can
 * only offer in-window days, so anything else was hand-crafted.
 */
export const windowDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date, e.g. 2027-01-28")
  .refine(isInWindow, "That date is outside the Jan 16 - Mar 15 2027 window");

export const availabilityEntrySchema = z.strictObject({
  date: windowDateSchema,
  status: availabilityStatusSchema,
});

export const availabilityBulkSchema = z.strictObject({
  // One entry per in-window day is the most anyone can legitimately send.
  entries: z.array(availabilityEntrySchema).max(eachDateInWindow().length),
});

export type AvailabilityBulkInput = z.infer<typeof availabilityBulkSchema>;
