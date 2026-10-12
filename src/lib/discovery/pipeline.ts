import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { resolveDeadline } from "@/lib/deadlines";
import { discoveryWindow } from "@/lib/time";
import type { CandidateEvent, CandidateEventInput } from "@/types/event";
import { resolveCity } from "./cities";
import { customSources } from "./connectors/custom";
import { eventbrite } from "./connectors/eventbrite";
import { luma } from "./connectors/luma";
import { meetup } from "./connectors/meetup";
import { webSearch } from "./connectors/websearch";
import { type Connector, errMsg, mapLimit } from "./connectors/types";
import { deduplicate, type MergedCandidate } from "./deduplicate";
import { normalise } from "./normalise";

export const CONNECTORS: Connector[] = [luma, eventbrite, meetup, customSources, webSearch];

export interface SourceReport {
  source: string;
  status: "success" | "partial" | "failed";
  retrieved: number;
  accepted: number;
  errors: string[];
}

export interface DiscoveryReport {
  sources: SourceReport[];
  merged: number;
  inserted: number;
  updated: number;
}

/** Fetch every connector, validate, de-duplicate and persist. A failing source never blocks the others. */
export async function runDiscovery(
  prefs: { cities: string[]; categories: string[]; topics: string[] },
  now = new Date(),
): Promise<DiscoveryReport> {
  const { from, to } = discoveryWindow(now);
  const ctx = {
    cities: prefs.cities.map(resolveCity),
    windowStart: from,
    windowEnd: to,
    focus: { categories: prefs.categories, topics: prefs.topics },
  };

  const accepted: CandidateEvent[] = [];
  const reports = await Promise.all(
    CONNECTORS.map(async (c): Promise<SourceReport> => {
      const [run] = await db()
        .insert(schema.sourceRuns)
        .values({ sourceName: c.name, status: "running" })
        .returning({ id: schema.sourceRuns.id });
      let report: SourceReport;
      try {
        const { candidates, errors, deferred } = await c.fetch(ctx);
        const rejected: string[] = [];
        let ok = 0;
        for (const raw of candidates) {
          const n = normalise(raw);
          if (!n.ok) {
            rejected.push(n.reason);
            continue;
          }
          if (n.event.startAt < from || n.event.startAt > to) continue; // outside the 30-day window
          accepted.push(n.event);
          ok++;
        }
        const allErrors = [...(deferred ? [deferred] : []), ...errors, ...rejected.slice(0, 10).map((r) => `rejected ${r}`)];
        // "failed" = the source is genuinely down; postponed work (quota) is "partial", never a failure.
        const status = candidates.length === 0 && errors.length > 0 ? "failed" : errors.length > 0 || deferred ? "partial" : "success";
        report = { source: c.name, status, retrieved: candidates.length, accepted: ok, errors: allErrors };
      } catch (e) {
        report = { source: c.name, status: "failed", retrieved: 0, accepted: 0, errors: [errMsg(e)] };
      }
      await db()
        .update(schema.sourceRuns)
        .set({
          status: report.status,
          finishedAt: new Date(),
          retrieved: report.retrieved,
          accepted: report.accepted,
          errors: report.errors.slice(0, 30),
        })
        .where(eq(schema.sourceRuns.id, run.id));
      return report;
    }),
  );

  const merged = deduplicate(accepted);
  const { inserted, updated } = await persist(merged);
  return { sources: reports, merged: merged.length, inserted, updated };
}

async function persist(groups: MergedCandidate[]) {
  if (groups.length === 0) return { inserted: 0, updated: 0, ids: [] as string[] };
  const d = db();

  // Prefetch matches for the whole batch: by source id, by canonical URL, by dedupe key.
  const sourcePairs = groups.flatMap((g) => g.sources.map((s) => `${s.sourceName}:${s.sourceEventId}`));
  const existingSources = await d
    .select({ eventId: schema.eventSources.eventId, name: schema.eventSources.sourceName, sid: schema.eventSources.sourceEventId })
    .from(schema.eventSources)
    .where(inArray(sql`${schema.eventSources.sourceName} || ':' || ${schema.eventSources.sourceEventId}`, sourcePairs));
  const bySource = new Map(existingSources.map((r) => [`${r.name}:${r.sid}`, r.eventId]));

  const urls = groups.flatMap((g) => g.sources.map((s) => s.eventUrl));
  const keys = groups.map((g) => g.key);
  const existingEvents = await d
    .select({ id: schema.events.id, url: schema.events.eventUrl, key: schema.events.dedupeKey, description: schema.events.description, allDay: schema.events.allDay })
    .from(schema.events)
    .where(or(inArray(schema.events.eventUrl, urls), inArray(schema.events.dedupeKey, keys)));
  const byUrl = new Map(existingEvents.map((r) => [r.url, r]));
  const byKey = new Map(existingEvents.map((r) => [r.key, r]));
  const byId = new Map(existingEvents.map((r) => [r.id, r]));

  let inserted = 0;
  let updated = 0;
  const ids: string[] = [];
  const now = new Date();

  await mapLimit(groups, 6, async (g) => {
    const p = g.primary;
    const matchId =
      g.sources.map((s) => bySource.get(`${s.sourceName}:${s.sourceEventId}`)).find(Boolean) ??
      g.sources.map((s) => byUrl.get(s.eventUrl)?.id).find(Boolean) ??
      byKey.get(g.key)?.id;

    const base = {
      title: p.title,
      startAt: p.startAt,
      endAt: p.endAt,
      allDay: p.allDay,
      timezone: p.timezone,
      venue: p.venue,
      city: p.city,
      country: p.country,
      format: p.format,
      organiser: p.organiser,
      eventUrl: p.eventUrl,
      registrationUrl: p.registrationUrl,
      registrationOpen: g.sources.some((s) => s.registrationOpen === true)
        ? true
        : g.sources.every((s) => s.registrationOpen === false)
          ? false
          : null,
      priceText: p.priceText,
      lastVerifiedAt: now,
      updatedAt: now,
    };
    const description = g.sources.map((s) => s.description).sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ?? null;

    let eventId: string;
    if (matchId) {
      const prev = byId.get(matchId);
      // Keep the longest description we have seen; only a genuinely new, longer text triggers AI re-processing.
      const longer = (description?.length ?? 0) > (prev?.description?.length ?? 0);
      // Never replace an exact time (from a detail page) with a date-only listing value.
      const keepTimes = prev && !prev.allDay && base.allDay;
      const { startAt, endAt, allDay, ...rest } = base;
      await d
        .update(schema.events)
        .set({
          ...rest,
          ...(keepTimes ? {} : { startAt, endAt, allDay }),
          ...(longer ? { description, aiStatus: "pending" as const } : {}),
        })
        .where(eq(schema.events.id, matchId));
      eventId = matchId;
      updated++;
    } else {
      const [row] = await d
        .insert(schema.events)
        .values({ ...base, description, dedupeKey: g.key })
        .onConflictDoUpdate({ target: schema.events.dedupeKey, set: { ...base, description } })
        .returning({ id: schema.events.id });
      eventId = row.id;
      inserted++;
    }

    for (const s of g.sources) {
      await d
        .insert(schema.eventSources)
        .values({
          eventId,
          sourceName: s.sourceName,
          sourceEventId: s.sourceEventId,
          sourceUrl: s.sourceUrl,
          statedDeadline: s.statedDeadline,
          retrievedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.eventSources.sourceName, schema.eventSources.sourceEventId],
          // Listings rarely state deadlines; keep one found earlier on the event's own page.
          set: { eventId, sourceUrl: s.sourceUrl, statedDeadline: sql`coalesce(excluded.stated_deadline, ${schema.eventSources.statedDeadline})`, retrievedAt: now },
        });
    }

    await refreshEventDeadline(eventId);
    ids.push(eventId);
  });

  return { inserted, updated, ids };
}

/** Source-stated deadlines win over AI-extracted ones; conflicts keep the earliest and are flagged. */
export async function refreshEventDeadline(eventId: string) {
  const d = db();
  {
    const stated = await d
      .select({ source: schema.eventSources.sourceName, deadline: schema.eventSources.statedDeadline })
      .from(schema.eventSources)
      .where(eq(schema.eventSources.eventId, eventId));
    const { deadline, conflict } = resolveDeadline(stated);
    if (deadline) {
      await d
        .update(schema.events)
        .set({ registrationDeadline: deadline, deadlineOrigin: "source", deadlineConflict: conflict, deadlineEvidence: null })
        .where(eq(schema.events.id, eventId));
    } else {
      // A source that used to state a deadline no longer does: drop it unless it came from the text.
      await d
        .update(schema.events)
        .set({ registrationDeadline: null, deadlineOrigin: null, deadlineConflict: false })
        .where(and(eq(schema.events.id, eventId), eq(schema.events.deadlineOrigin, "source")));
    }
  }
}

/** Validate, de-duplicate and store events from a single ad-hoc source (e.g. an event pasted by the user). */
export async function persistCandidates(raw: CandidateEventInput[]) {
  const accepted: CandidateEvent[] = [];
  const rejected: string[] = [];
  for (const r of raw) {
    const n = normalise(r);
    if (n.ok) accepted.push(n.event);
    else rejected.push(n.reason);
  }
  const { ids } = await persist(deduplicate(accepted));
  return { ids, rejected };
}
