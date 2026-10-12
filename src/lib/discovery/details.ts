import "server-only";
import { and, asc, eq, gte, isNull, lt, lte, or } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { discoveryWindow } from "@/lib/time";
import { parseEventbriteDetail } from "./connectors/eventbrite";
import { errMsg, fetchText, sleep } from "./connectors/types";
import { refreshEventDeadline } from "./pipeline";

const PER_RUN = 20;
const GAP_MS = 1_500;
const RECHECK_MS = 3 * 86_400_000;

export interface DetailReport {
  checked: number;
  deadlinesFound: number;
  timesFixed: number;
  errors: string[];
}

/**
 * Eventbrite listing pages give no registration deadline and only a date. Each event's own
 * page states ticket sales end (`offers.availabilityEnds`) and the exact start time.
 * Visit a few per run (soonest first, rechecked every 3 days), politely paced.
 */
export async function enrichEventbriteDetails(now = new Date()): Promise<DetailReport> {
  const report: DetailReport = { checked: 0, deadlinesFound: 0, timesFixed: 0, errors: [] };
  const { to } = discoveryWindow(now);
  const rows = await db()
    .select({ src: schema.eventSources, ev: schema.events })
    .from(schema.eventSources)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventSources.eventId))
    .where(
      and(
        eq(schema.eventSources.sourceName, "Eventbrite"),
        gte(schema.events.startAt, now),
        lte(schema.events.startAt, to),
        or(isNull(schema.eventSources.detailCheckedAt), lt(schema.eventSources.detailCheckedAt, new Date(now.getTime() - RECHECK_MS))),
      ),
    )
    .orderBy(asc(schema.events.startAt))
    .limit(PER_RUN);

  for (const [i, { src, ev }] of rows.entries()) {
    if (i > 0) await sleep(GAP_MS);
    try {
      const detail = parseEventbriteDetail(await fetchText(src.sourceUrl));
      await db()
        .update(schema.eventSources)
        .set({ statedDeadline: detail?.deadline ?? null, detailCheckedAt: new Date() })
        .where(eq(schema.eventSources.id, src.id));
      report.checked++;
      if (!detail) continue;
      if (detail.deadline) report.deadlinesFound++;

      const patch: Partial<typeof schema.events.$inferInsert> = {};
      if (ev.allDay && detail.startAt) {
        patch.startAt = detail.startAt;
        patch.endAt = detail.endAt && detail.endAt >= detail.startAt ? detail.endAt : null;
        patch.allDay = false;
        report.timesFixed++;
      }
      if (detail.soldOut) patch.registrationOpen = false;
      // A fuller description helps classification, but only worth it before AI has run.
      if (detail.description && ev.aiStatus !== "done" && detail.description.length > (ev.description?.length ?? 0)) {
        patch.description = detail.description.slice(0, 8000);
      }
      if (Object.keys(patch).length) await db().update(schema.events).set(patch).where(eq(schema.events.id, ev.id));
      await refreshEventDeadline(ev.id);
    } catch (e) {
      report.errors.push(`${src.sourceUrl}: ${errMsg(e)}`); // not marked checked, so it is retried next run
    }
  }
  return report;
}
