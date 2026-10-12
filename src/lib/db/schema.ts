import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const eventFormat = pgEnum("event_format", ["in_person", "online", "hybrid", "unknown"]);
export const pipelineStatus = pgEnum("pipeline_status", [
  "discovered",
  "saved",
  "to_register",
  "registered",
  "attended",
  "follow_up_complete",
]);
export const aiStatus = pgEnum("ai_status", ["pending", "done", "failed"]);
export const deadlineOrigin = pgEnum("deadline_origin", ["source", "ai_extracted"]);
export const runStatus = pgEnum("run_status", ["running", "success", "partial", "failed"]);
export const digestStatus = pgEnum("digest_status", ["sending", "sent", "failed"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    categories: text("categories").array().notNull(),
    cities: text("cities").array().notNull(),
    topics: text("topics").array().notNull(),
    formats: text("formats").array().notNull(),
    minScore: integer("min_score").notNull().default(50),
    digestEmail: text("digest_email"),
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    calendlyUrl: text("calendly_url"),
    isDefault: boolean("is_default").notNull().default(true),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("min_score_range", sql`${t.minScore} between 0 and 100`)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    startAt: ts("start_at").notNull(),
    endAt: ts("end_at"),
    /** true when the source only gave a date, not a time */
    allDay: boolean("all_day").notNull().default(false),
    timezone: text("timezone"),
    venue: text("venue"),
    city: text("city"),
    country: text("country"),
    format: eventFormat("format").notNull().default("unknown"),
    categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
    audience: text("audience"),
    organiser: text("organiser"),
    eventUrl: text("event_url").notNull(),
    registrationUrl: text("registration_url"),
    registrationDeadline: ts("registration_deadline"),
    deadlineOrigin: deadlineOrigin("deadline_origin"),
    deadlineEvidence: text("deadline_evidence"),
    deadlineConflict: boolean("deadline_conflict").notNull().default(false),
    registrationOpen: boolean("registration_open"),
    priceText: text("price_text"),
    summary: text("summary"),
    dedupeKey: text("dedupe_key").notNull(),
    aiStatus: aiStatus("ai_status").notNull().default("pending"),
    aiError: text("ai_error"),
    lastVerifiedAt: ts("last_verified_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("events_dedupe_key_uq").on(t.dedupeKey),
    index("events_event_url_idx").on(t.eventUrl),
    index("events_start_at_idx").on(t.startAt),
    index("events_deadline_idx").on(t.registrationDeadline),
    check("end_after_start", sql`${t.endAt} is null or ${t.endAt} >= ${t.startAt}`),
  ],
);

export const eventSources = pgTable(
  "event_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    /** deadline as stated by this source, kept so conflicts are visible */
    statedDeadline: ts("stated_deadline"),
    /** When the source's own event page was last read for detail (e.g. Eventbrite ticket sales end). */
    detailCheckedAt: ts("detail_checked_at"),
    retrievedAt: ts("retrieved_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("event_sources_source_uq").on(t.sourceName, t.sourceEventId),
    index("event_sources_event_idx").on(t.eventId),
  ],
);

/** User-added sources: conference sites, iSPIRT pages, newsletter RSS/Atom feeds, iCal feeds. */
export const customSources = pgTable(
  "custom_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastCheckedAt: ts("last_checked_at"),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    eventsFound: integer("events_found").notNull().default(0),
    /** Hash of the text last sent to Gemini — unchanged pages are not re-extracted. */
    contentHash: text("content_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("custom_sources_url_uq").on(t.url)],
);

export const eventScores = pgTable(
  "event_scores",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ruleScore: integer("rule_score").notNull(),
    aiScore: integer("ai_score"),
    finalScore: integer("final_score").notNull(),
    reason: text("reason"),
    prefsHash: text("prefs_hash").notNull(),
    scoredAt: ts("scored_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    check("final_score_range", sql`${t.finalScore} between 0 and 100`),
  ],
);

export const savedEvents = pgTable(
  "saved_events",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    status: pipelineStatus("status").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

export const checklistTasks = pgTable(
  "checklist_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    detail: text("detail"),
    done: boolean("done").notNull().default(false),
    doneAt: ts("done_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("checklist_task_uq").on(t.userId, t.weekStart, t.kind, t.eventId),
    index("checklist_week_idx").on(t.userId, t.weekStart),
  ],
);

export const digestRuns = pgTable(
  "digest_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** scheduled:<user>:<week> or manual:<user>:<minute> — the duplicate-send guard */
    idempotencyKey: text("idempotency_key").notNull(),
    trigger: text("trigger").notNull(),
    weekStart: date("week_start").notNull(),
    status: digestStatus("status").notNull(),
    recipient: text("recipient"),
    eventCount: integer("event_count").notNull().default(0),
    urgentCount: integer("urgent_count").notNull().default(0),
    attempts: integer("attempts").notNull().default(1),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [uniqueIndex("digest_runs_idem_uq").on(t.idempotencyKey)],
);

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  digestRunId: uuid("digest_run_id").references(() => digestRuns.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  recipient: text("recipient"),
  status: text("status").notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceName: text("source_name").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    status: runStatus("status").notNull(),
    retrieved: integer("retrieved").notNull().default(0),
    accepted: integer("accepted").notNull().default(0),
    errors: jsonb("errors").$type<string[]>().notNull().default([]),
  },
  (t) => [index("source_runs_source_idx").on(t.sourceName, t.startedAt)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    trigger: text("trigger").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    status: runStatus("status").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("job_runs_job_idx").on(t.job, t.startedAt)],
);

export type EventRow = typeof events.$inferSelect;
export type PreferencesRow = typeof userPreferences.$inferSelect;
export type PipelineStatus = (typeof pipelineStatus.enumValues)[number];
