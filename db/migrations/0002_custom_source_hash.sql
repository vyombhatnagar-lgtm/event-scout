ALTER TABLE "custom_sources" ADD COLUMN "content_hash" text;--> statement-breakpoint
INSERT INTO "custom_sources" ("label", "url") VALUES
  ('AllEvents · Bengaluru business', 'https://allevents.in/bangalore/business'),
  ('AllEvents · Mumbai business', 'https://allevents.in/mumbai/business'),
  ('AllEvents · Delhi business', 'https://allevents.in/delhi/business'),
  ('NASSCOM events', 'https://nasscom.in/events'),
  ('iSPIRT ProductNation', 'https://pn.ispirt.in/feed/')
ON CONFLICT ("url") DO NOTHING;
