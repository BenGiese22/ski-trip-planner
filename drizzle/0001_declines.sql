CREATE TABLE "declines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cookie_token" uuid NOT NULL,
	"name" text,
	"email" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "declines_cookie_token_unique" UNIQUE("cookie_token")
);
