CREATE TABLE "availability" (
	"respondent_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "availability_respondent_id_date_pk" PRIMARY KEY("respondent_id","date")
);
--> statement-breakpoint
CREATE TABLE "destination_votes" (
	"respondent_id" uuid NOT NULL,
	"destination_slug" text NOT NULL,
	"rank" integer NOT NULL,
	CONSTRAINT "destination_votes_respondent_id_destination_slug_pk" PRIMARY KEY("respondent_id","destination_slug")
);
--> statement-breakpoint
CREATE TABLE "respondents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cookie_token" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"plus_one" boolean DEFAULT false NOT NULL,
	"home_airport" text NOT NULL,
	"ski_level" text NOT NULL,
	"ski_days" integer,
	"already_has_pass" boolean DEFAULT false NOT NULL,
	"gear_status" text,
	"plus_one_ski_days" integer,
	"plus_one_already_has_pass" boolean DEFAULT false NOT NULL,
	"plus_one_gear_status" text,
	"notes" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "respondents_cookie_token_unique" UNIQUE("cookie_token")
);
--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_respondent_id_respondents_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."respondents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_votes" ADD CONSTRAINT "destination_votes_respondent_id_respondents_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."respondents"("id") ON DELETE cascade ON UPDATE no action;