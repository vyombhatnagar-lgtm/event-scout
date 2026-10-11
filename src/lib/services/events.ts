import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { PipelineStatus } from "@/lib/db/schema";
import { deadlineState, type DeadlineState } from "@/lib/deadlines";
import { discoveryWindow } from "@/lib/time";

export interface SourceRef {
  name: string;
  url: string;
  retrievedAt: Date;
}

export interface EventView {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  venue: string | null;
  city: string | null;
  country: string | null;
  format: string;
  categories: string[];
  audience: string | null;
  organiser: string | null;
  eventUrl: string;
  registrationUrl: string | null;
  registrationOpen: boolean | null;
  deadline: Date | null;
  deadlineOrigin: "source" | "ai_extracted" | null;
  deadlineEvidence: string | null;
  deadlineConflict: boolean;
  deadlineState: DeadlineState;
  priceText: string | null;
  aiStatus: string;
  score: number | null;
  aiScore: number | null;
  ruleScore: number | null;
  reason: string | null;
  status: PipelineStatus;
  sources: SourceRef[];
  lastVerifiedAt: Date;
}

const scoreJoin = (userId: string) => and(eq(schema.eventScores.eventId, schema.events.id), eq(schema.eventScores.userId, userId));
const savedJoin = (userId: string) => and(eq(schema.savedEvents.eventId, schema.events.id), eq(schema.savedEvents.userId, userId));

async function attachSources(ids: string[]) {
  if (ids.length === 0) return new Map<string, SourceRef[]>();
  const rows = await db()
    .select()
    .from(schema.eventSources)
    .where(inArray(schema.eventSources.eventId, ids))
    .orderBy(asc(schema.eventSources.sourceName));
  const m = new Map<string, SourceRef[]>();
  for (const r of rows) {
    const list = m.get(r.eventId) ?? [];
    list.push({ name: r.sourceName, url: r.sourceUrl, retrievedAt: r.retrievedAt });
    m.set(r.eventId, list);
  }
  return m;
}

type Row = {
  e: typeof schema.events.$inferSelect;
  s: typeof schema.eventScores.$inferSelect | null;
  sv: typeof schema.savedEvents.$inferSelect | null;
};

function toView(r: Row, sources: SourceRef[], now: Date): EventView {
  const e = r.e;
  return {
    id: e.id,
    title: e.title,
    summary: e.summary,
    description: e.description,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    venue: e.venue,
    city: e.city,
    country: e.country,
    format: e.format,
    categories: e.categories,
    audience: e.audience,
    organiser: e.organiser,
    eventUrl: e.eventUrl,
    registrationUrl: e.registrationUrl,
    registrationOpen: e.registrationOpen,
    deadline: e.registrationDeadline,
    deadlineOrigin: e.deadlineOrigin,
    deadlineEvidence: e.deadlineEvidence,
    deadlineConflict: e.deadlineConflict,
    deadlineState: deadlineState(e.registrationDeadline, now),
    priceText: e.priceText,
    aiStatus: e.aiStatus,
    score: r.s?.finalScore ?? null,
    aiScore: r.s?.aiScore ?? null,
    ruleScore: r.s?.ruleScore ?? null,
    reason: r.s?.reason ?? null,
    status: r.sv?.status ?? "discovered",
    sources,
    lastVerifiedAt: e.lastVerifiedAt,
  };
}

/** All events in the next-30-day window, ranked by final score (unscored last). */
export async function listWindowEvents(userId: string, now = new Date()): Promise<EventView[]> {
  const { to } = discoveryWindow(now);
  const rows = await db()
    .select({ e: schema.events, s: schema.eventScores, sv: schema.savedEvents })
    .from(schema.events)
    .leftJoin(schema.eventScores, scoreJoin(userId))
    .leftJoin(schema.savedEvents, savedJoin(userId))
    .where(and(gte(schema.events.startAt, now), lte(schema.events.startAt, to)))
    .orderBy(sql`${schema.eventScores.finalScore} desc nulls last`, asc(schema.events.startAt));
  const sources = await attachSources(rows.map((r) => r.e.id));
  return rows.map((r) => toView(r, sources.get(r.e.id) ?? [], now));
}

/** Events in the user's pipeline (any status beyond "discovered"), including past ones for follow-up. */
export async function listPipelineEvents(userId: string, now = new Date()): Promise<EventView[]> {
  const rows = await db()
    .select({ e: schema.events, s: schema.eventScores, sv: schema.savedEvents })
    .from(schema.savedEvents)
    .innerJoin(schema.events, eq(schema.events.id, schema.savedEvents.eventId))
    .leftJoin(schema.eventScores, scoreJoin(userId))
    .where(eq(schema.savedEvents.userId, userId))
    .orderBy(asc(schema.events.startAt));
  const sources = await attachSources(rows.map((r) => r.e.id));
  return rows.map((r) => toView(r, sources.get(r.e.id) ?? [], now));
}

export async function getEvent(userId: string, id: string, now = new Date()): Promise<EventView | null> {
  const [r] = await db()
    .select({ e: schema.events, s: schema.eventScores, sv: schema.savedEvents })
    .from(schema.events)
    .leftJoin(schema.eventScores, scoreJoin(userId))
    .leftJoin(schema.savedEvents, savedJoin(userId))
    .where(eq(schema.events.id, id));
  if (!r) return null;
  const sources = await attachSources([id]);
  return toView(r, sources.get(id) ?? [], now);
}

/** "discovered" is the absence of a pipeline row; every other status is stored. */
export async function setPipelineStatus(userId: string, eventId: string, status: PipelineStatus) {
  if (status === "discovered") {
    await db().delete(schema.savedEvents).where(and(eq(schema.savedEvents.userId, userId), eq(schema.savedEvents.eventId, eventId)));
    return;
  }
  const values = { userId, eventId, status, updatedAt: new Date() };
  await db()
    .insert(schema.savedEvents)
    .values(values)
    .onConflictDoUpdate({ target: [schema.savedEvents.userId, schema.savedEvents.eventId], set: { status, updatedAt: values.updatedAt } });
}

export async function eventExists(id: string) {
  const [r] = await db().select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.id, id));
  return Boolean(r);
}

export async function latestSourceRuns() {
  return db().execute<{
    source_name: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    retrieved: number;
    accepted: number;
    errors: string[];
    last_success: string | null;
  }>(sql`
    select distinct on (r.source_name) r.source_name, r.status, r.started_at, r.finished_at, r.retrieved, r.accepted, r.errors,
      (select max(finished_at) from source_runs s where s.source_name = r.source_name and s.status in ('success','partial')) as last_success
    from source_runs r
    order by r.source_name, r.started_at desc`);
}

export async function latestJobRuns(limit = 12) {
  return db().select().from(schema.jobRuns).orderBy(desc(schema.jobRuns.startedAt)).limit(limit);
}

export async function latestDigestRuns(userId: string, limit = 6) {
  return db()
    .select()
    .from(schema.digestRuns)
    .where(eq(schema.digestRuns.userId, userId))
    .orderBy(desc(schema.digestRuns.createdAt))
    .limit(limit);
}
