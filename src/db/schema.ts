import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AirportCode, DestinationSlug } from "@/data/types";
import type { GearStatus, SkiDays } from "@/lib/costs";

export type SkiLevel = "beginner" | "intermediate" | "advanced";
export type AvailabilityStatus = "available" | "maybe" | "unavailable";

// One row per person who has completed intake. Nothing is written until all
// five intake fields are filled (PLAN.md section 16, decision 7), which is why
// name/email/home_airport/ski_level are NOT NULL here even though PLAN.md
// section 5 drafted the latter two as nullable — by the time a row exists,
// they're guaranteed present.
export const respondents = pgTable("respondents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cookieToken: uuid("cookie_token").notNull().unique(),

  // Intake — all required before the row is created.
  name: text("name").notNull(),
  email: text("email").notNull(),
  plusOne: boolean("plus_one").notNull().default(false),
  homeAirport: text("home_airport").$type<AirportCode>().notNull(),
  skiLevel: text("ski_level").$type<SkiLevel>().notNull(),

  // Cost inputs — filled in later, so nullable. ski_days is null when the
  // person already holds a pass; section 16 decision 6 leans on that.
  skiDays: integer("ski_days").$type<SkiDays>(),
  alreadyHasPass: boolean("already_has_pass").notNull().default(false),
  gearStatus: text("gear_status").$type<GearStatus>(),
  plusOneSkiDays: integer("plus_one_ski_days").$type<SkiDays>(),
  plusOneAlreadyHasPass: boolean("plus_one_already_has_pass").notNull().default(false),
  plusOneGearStatus: text("plus_one_gear_status").$type<GearStatus>(),

  notes: text("notes"),

  // Null while in progress; set when they hit "Save & finish". Autosave is
  // what makes the data durable — this only marks it final (section 6).
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per (respondent, date). Per-day rows rather than a range because
// real availability is often non-contiguous (section 7).
export const availability = pgTable(
  "availability",
  {
    respondentId: uuid("respondent_id")
      .notNull()
      .references(() => respondents.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: text("status").$type<AvailabilityStatus>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.respondentId, table.date] })],
);

// Phase 2 writes exactly one row per respondent at rank 1 — the single
// destination select from section 16, decision 3. The table keeps the ranked
// shape so full multi-destination ranking can land later without a migration.
export const destinationVotes = pgTable(
  "destination_votes",
  {
    respondentId: uuid("respondent_id")
      .notNull()
      .references(() => respondents.id, { onDelete: "cascade" }),
    destinationSlug: text("destination_slug").$type<DestinationSlug>().notNull(),
    rank: integer("rank").notNull(),
  },
  (table) => [primaryKey({ columns: [table.respondentId, table.destinationSlug] })],
);

export type Respondent = typeof respondents.$inferSelect;
export type NewRespondent = typeof respondents.$inferInsert;
export type AvailabilityRow = typeof availability.$inferSelect;
export type DestinationVote = typeof destinationVotes.$inferSelect;
