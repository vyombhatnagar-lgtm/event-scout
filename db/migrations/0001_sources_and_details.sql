CREATE TABLE "custom_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"events_found" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_sources" ADD COLUMN "detail_checked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_sources_url_uq" ON "custom_sources" USING btree ("url");