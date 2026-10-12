import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { finalScore, ruleScore } from "@/lib/ranking/rules";
import { prefsHash } from "@/lib/services/user";
import { discoveryWindow } from "@/lib/time";
import type { Preferences } from "@/types/preferences";
import { classifyEvents } from "./classification";
import { extractDeadlines } from "./deadlines";
import { AiError } from "./gemini";
import { assessRelevance } from "./ranking";

const CLASSIFY_BATCH = 15;
const RANK_BATCH = 30;

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export interface AiReport {
  classified: number;
  classifyFailed: number;
  deadlinesFound: number;
  deadlinesRejected: number;
  scored: number;
  scoredRulesOnly: number;
  errors: string[];
  stoppedEarly: boolean;
}

/**
 * Enrich events that have not been through AI yet: classification + summary, then
 * explicit deadline extraction for events whose sources did not state one.
 */
export async function enrichPending(report: AiReport, budgetEnds: number, now = new Date()) {
  const { to } = discoveryWindow(now);
  const pending = await db()
    .select()
    .from(schema.events)
    .where(and(inArray(schema.events.aiStatus, ["pending", "failed"]), gte(schema.events.startAt, now), lte(schema.events.startAt, to)))
    .orderBy(asc(schema.events.startAt))
    .limit(96);

  for (const batch of chunk(pending, CLASSIFY_BATCH)) {
    if (Date.now() > budgetEnds) {
      report.stoppedEarly = true;
      return;
    }
    try {
      const results = await classifyEvents(
        batch.map((e) => ({ id: e.id, title: e.title, description: e.description, organiser: e.organiser, city: e.city, format: e.format })),
      );
      const got = new Set(results.map((r) => r.id));
      for (const r of results) {
        await db()
          .update(schema.events)
          .set({ categories: r.categories, audience: r.audience, summary: r.summary, aiStatus: "done", aiError: null })
          .where(eq(schema.events.id, r.id));
      }
      // Re-classified content invalidates any earlier relevance score.
      if (got.size) await db().delete(schema.eventScores).where(inArray(schema.eventScores.eventId, [...got]));
      report.classified += results.length;
      const missing = batch.filter((e) => !got.has(e.id)).map((e) => e.id);
      if (missing.length) {
        await db().update(schema.events).set({ aiStatus: "failed", aiError: "No result returned for this event" }).where(inArray(schema.events.id, missing));
        report.classifyFailed += missing.length;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push(`classify: ${msg}`);
      // A quota stop is not a failure of these events: leave them pending for the next run.
      const quota = e instanceof AiError && e.kind === "rate_limit";
      await db()
        .update(schema.events)
        .set({ aiStatus: quota ? "pending" : "failed", aiError: msg.slice(0, 300) })
        .where(inArray(schema.events.id, batch.map((b) => b.id)));
      if (!quota) report.classifyFailed += batch.length;
      if (e instanceof AiError && (e.kind === "config" || e.kind === "rate_limit")) {
        report.stoppedEarly = true;
        return;
      }
    }

    // Deadline extraction, only where no source states one.
    const needDeadline = batch.filter((e) => !e.deadlineOrigin && e.description);
    if (needDeadline.length === 0) continue;
    try {
      const found = await extractDeadlines(
        needDeadline.map((e) => ({ id: e.id, title: e.title, description: e.description!, eventStart: e.startAt.toISOString() })),
      );
      for (const f of found) {
        if (f.deadline) {
          await db()
            .update(schema.events)
            .set({ registrationDeadline: f.deadline, deadlineOrigin: "ai_extracted", deadlineEvidence: f.evidence })
            .where(and(eq(schema.events.id, f.id), isNull(schema.events.deadlineOrigin)));
          report.deadlinesFound++;
        } else if (f.rejected) {
          report.deadlinesRejected++;
        }
      }
    } catch (e) {
      report.errors.push(`deadlines: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** Score every event in the window whose score is missing or stale for the current preferences. */
export async function scoreForUser(userId: string, prefs: Preferences, report: AiReport, budgetEnds: number, now = new Date()) {
  const { to } = discoveryWindow(now);
  const hash = prefsHash(prefs);
  const rows = await db()
    .select({ e: schema.events, s: schema.eventScores })
    .from(schema.events)
    .leftJoin(schema.eventScores, and(eq(schema.eventScores.eventId, schema.events.id), eq(schema.eventScores.userId, userId)))
    .where(
      and(
        gte(schema.events.startAt, now),
        lte(schema.events.startAt, to),
        or(
          isNull(schema.eventScores.eventId),
          sql`${schema.eventScores.prefsHash} <> ${hash}`,
          sql`${schema.eventScores.aiScore} is null and ${schema.events.aiStatus} = 'done'`,
        ),
      ),
    )
    .orderBy(asc(schema.events.startAt));

  const events = rows.map((r) => r.e);
  let aiAvailable = true;
  for (const batch of chunk(events, RANK_BATCH)) {
    let ai = new Map<string, { score: number; reason: string }>();
    const aiReady = batch.filter((e) => e.aiStatus === "done");
    if (aiAvailable && aiReady.length && Date.now() < budgetEnds) {
      try {
        const out = await assessRelevance(
          aiReady.map((e) => ({
            id: e.id,
            title: e.title,
            summary: e.summary,
            description: e.description,
            categories: e.categories,
            audience: e.audience,
            organiser: e.organiser,
            city: e.city,
            format: e.format,
            start: e.startAt.toISOString(),
          })),
          prefs,
        );
        ai = new Map(out.map((o) => [o.id, o]));
      } catch (err) {
        report.errors.push(`ranking: ${err instanceof Error ? err.message : String(err)}`);
        if (err instanceof AiError && (err.kind === "config" || err.kind === "rate_limit")) aiAvailable = false;
      }
    } else if (Date.now() >= budgetEnds) {
      report.stoppedEarly = true;
    }

    for (const e of batch) {
      const rules = ruleScore(e, prefs, now);
      const a = ai.get(e.id);
      const final = finalScore(rules, a?.score ?? null, e, prefs);
      const reason = a?.reason ?? null;
      const values = { eventId: e.id, userId, ruleScore: rules.total, aiScore: a?.score ?? null, finalScore: final, reason, prefsHash: hash, scoredAt: new Date() };
      await db()
        .insert(schema.eventScores)
        .values(values)
        .onConflictDoUpdate({ target: [schema.eventScores.eventId, schema.eventScores.userId], set: values });
      if (a) report.scored++;
      else report.scoredRulesOnly++;
    }
  }
}

export function emptyAiReport(): AiReport {
  return { classified: 0, classifyFailed: 0, deadlinesFound: 0, deadlinesRejected: 0, scored: 0, scoredRulesOnly: 0, errors: [], stoppedEarly: false };
}
