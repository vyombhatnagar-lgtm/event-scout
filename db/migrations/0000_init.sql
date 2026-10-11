CREATE TYPE "public"."ai_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."deadline_origin" AS ENUM('source', 'ai_extracted');--> statement-breakpoint
CREATE TYPE "public"."digest_status" AS ENUM('sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_format" AS ENUM('in_person', 'online', 'hybrid', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."pipeline_status" AS ENUM('discovered', 'saved', 'to_register', 'registered', 'attended', 'follow_up_complete');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'success', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "checklist_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid,
	"week_start" date NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"trigger" text NOT NULL,
	"week_start" date NOT NULL,
	"status" "digest_status" NOT NULL,
	"recipient" text,
	"event_count" integer DEFAULT 0 NOT NULL,
	"urgent_count" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "event_scores" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rule_score" integer NOT NULL,
	"ai_score" integer,
	"final_score" integer NOT NULL,
	"reason" text,
	"prefs_hash" text NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_scores_event_id_user_id_pk" PRIMARY KEY("event_id","user_id"),
	CONSTRAINT "final_score_range" CHECK ("event_scores"."final_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "event_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"source_name" text NOT NULL,
	"source_event_id" text NOT NULL,
	"source_url" text NOT NULL,
	"stated_deadline" timestamp with time zone,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"venue" text,
	"city" text,
	"country" text,
	"format" "event_format" DEFAULT 'unknown' NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"audience" text,
	"organiser" text,
	"event_url" text NOT NULL,
	"registration_url" text,
	"registration_deadline" timestamp with time zone,
	"deadline_origin" "deadline_origin",
	"deadline_evidence" text,
	"deadline_conflict" boolean DEFAULT false NOT NULL,
	"registration_open" boolean,
	"price_text" text,
	"summary" text,
	"dedupe_key" text NOT NULL,
	"ai_status" "ai_status" DEFAULT 'pending' NOT NULL,
	"ai_error" text,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "end_after_start" CHECK ("events"."end_at" is null or "events"."end_at" >= "events"."start_at")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "run_status" NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_run_id" uuid,
	"channel" text NOT NULL,
	"recipient" text,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_events" (
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "pipeline_status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_events_user_id_event_id_pk" PRIMARY KEY("user_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "run_status" NOT NULL,
	"retrieved" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"categories" text[] NOT NULL,
	"cities" text[] NOT NULL,
	"topics" text[] NOT NULL,
	"formats" text[] NOT NULL,
	"min_score" integer DEFAULT 50 NOT NULL,
	"digest_email" text,
	"digest_enabled" boolean DEFAULT true NOT NULL,
	"calendly_url" text,
	"is_default" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "min_score_range" CHECK ("user_preferences"."min_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD CONSTRAINT "checklist_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tasks" ADD CONSTRAINT "checklist_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_runs" ADD CONSTRAINT "digest_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_digest_run_id_digest_runs_id_fk" FOREIGN KEY ("digest_run_id") REFERENCES "public"."digest_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_events" ADD CONSTRAINT "saved_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_events" ADD CONSTRAINT "saved_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_task_uq" ON "checklist_tasks" USING btree ("user_id","week_start","kind","event_id");--> statement-breakpoint
CREATE INDEX "checklist_week_idx" ON "checklist_tasks" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "digest_runs_idem_uq" ON "digest_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "event_sources_source_uq" ON "event_sources" USING btree ("source_name","source_event_id");--> statement-breakpoint
CREATE INDEX "event_sources_event_idx" ON "event_sources" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_key_uq" ON "events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "events_event_url_idx" ON "events" USING btree ("event_url");--> statement-breakpoint
CREATE INDEX "events_start_at_idx" ON "events" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "events_deadline_idx" ON "events" USING btree ("registration_deadline");--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "source_runs_source_idx" ON "source_runs" USING btree ("source_name","started_at");