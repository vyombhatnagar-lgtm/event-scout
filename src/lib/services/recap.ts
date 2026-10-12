import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { carryOver } from "@/lib/checklist/carryover";
import { db, schema } from "@/lib/db/client";
import { previousWeekStart, weekStart, zonedMidnight } from "@/lib/time";
import { listTasksForWeek } from "./checklist";
import type { EventView } from "./events";

export interface LastWeekRecap {
  /** Monday and Sunday of last week (YYYY-MM-DD, IST). */
  from: string;
  to: string;
  /** Events in Vikram's pipeline that took place last week. */
  happened: EventView[];
  carry: ReturnType<typeof carryOver<Awaited<ReturnType<typeof listTasksForWeek>>[number]>>;
  followUps: EventView[];
  briefingSentAt: Date | null;
  newSinceMonday: number;
}

/** Everything about last week that still matters this week, from real records only. */
export async function lastWeekRecap(userId: string, pipeline: EventView[], thisWeekTasks: { id: string; kind: string; eventId: string | null; label: string; detail: string | null; done: boolean }[], now = new Date()): Promise<LastWeekRecap> {
  const prev = previousWeekStart(now);
  const cur = weekStart(now);
  const prevStart = zonedMidnight(prev);
  const curStart = zonedMidnight(cur);
  const [y, m, d] = prev.split("-").map(Number);
  const to = new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);

  const [lastWeekTasks, briefing, fresh] = await Promise.all([
    listTasksForWeek(userId, prev),
    db()
      .select({ sentAt: schema.digestRuns.sentAt })
      .from(schema.digestRuns)
      .where(and(eq(schema.digestRuns.userId, userId), eq(schema.digestRuns.weekStart, prev), eq(schema.digestRuns.trigger, "scheduled"), eq(schema.digestRuns.status, "sent")))
      .limit(1),
    db().select({ n: count() }).from(schema.events).where(gte(schema.events.createdAt, curStart)),
  ]);

  const carry = carryOver(lastWeekTasks, thisWeekTasks, pipeline, cur, now);
  const happened = pipeline
    .filter((e) => e.startAt >= prevStart && e.startAt < curStart && e.status !== "dismissed")
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const followUps = pipeline.filter((e) => e.status === "attended");

  return {
    from: prev,
    to,
    happened,
    carry,
    followUps,
    briefingSentAt: briefing[0]?.sentAt ?? null,
    newSinceMonday: Number(fresh[0]?.n ?? 0),
  };
}
