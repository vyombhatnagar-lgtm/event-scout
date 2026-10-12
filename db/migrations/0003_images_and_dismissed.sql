ALTER TYPE "public"."pipeline_status" ADD VALUE 'dismissed';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_url" text;