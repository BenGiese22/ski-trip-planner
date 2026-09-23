-- rate_limits reached production through an unrecorded `drizzle-kit push` in
-- Phase 3, so no earlier file creates it (0001's snapshot already lists it).
-- IF NOT EXISTS: a no-op against production, which already has the table;
-- creates it on any database built from these files alone.
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"bucket_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_bucket_key_window_start_pk" PRIMARY KEY("bucket_key","window_start")
);
