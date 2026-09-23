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

// Every table gets .enableRLS() with no policies. Supabase's Data API exposes
// `public` tables over REST to the anon key, which is public by design, so RLS
// is the only thing keeping guest names and emails off it. The app connects
// as `postgres`, the table owner, which bypasses RLS — so it's unaffected.
// e2e/schema.spec.ts fails if a table is added without it.

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
}).enableRLS();

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
).enableRLS();

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
).enableRLS();

/**
 * Fixed-window rate limiting (PLAN.md §17 decision 8). One row per
 * (bucket, window); rows older than PRUNE_AFTER_MS are deleted
 * opportunistically by the limiter itself rather than by a cron job, since
 * nothing ever reads a window once it has rolled over (decision 6).
 *
 * Deliberately unrelated to respondents — no foreign key, no cascade. Rate
 * limiting has to work for callers who have no respondent row at all, which
 * is precisely the case worth limiting.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    bucketKey: text("bucket_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.bucketKey, table.windowStart] })],
).enableRLS();

/**
 * One row per browser that has said "I can't make it". Kept apart from
 * `respondents` because that table's intake columns are NOT NULL by design
 * (nothing is written until intake is complete) and a decline has no
 * airport or ski level to give. The same cookie token may appear in both
 * tables at once — someone can finish a response and later bow out — and
 * when it does, the decline wins everywhere on /admin (PLAN.md §19).
 *
 * Deliberately no foreign key to respondents, like rate_limits: a decline
 * has to work for a browser with no respondent row, which is the common
 * case. name/email are nullable because they're populated two ways — from
 * the form for a first-time visitor, or copied from the respondent row
 * server-side — not because either path ever leaves them empty.
 */
export const declines = pgTable("declines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  cookieToken: uuid("cookie_token").notNull().unique(),
  name: text("name"),
  email: text("email"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type Respondent = typeof respondents.$inferSelect;
export type NewRespondent = typeof respondents.$inferInsert;
export type AvailabilityRow = typeof availability.$inferSelect;
export type DestinationVote = typeof destinationVotes.$inferSelect;
export type Decline = typeof declines.$inferSelect;
