import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { draftWeeklyTasks } from "@/lib/checklist/generate";
import { db, schema } from "@/lib/db/client";
import { weekStart, zonedMidnight } from "@/lib/time";
import type { Preferences } from "@/types/preferences";
import { listPipelineEvents, listWindowEvents } from "./events";

/** Add any newly relevant tasks for this week; existing tasks (and their done state) are kept. */
export async function syncWeeklyTasks(userId: string, prefs: Preferences, now = new Date()) {
  const week = weekStart(now);
  const [windowEvents, pipeline] = await Promise.all([listWindowEvents(userId, now), listPipelineEvents(userId, now)]);
  const drafts = draftWeeklyTasks(windowEvents, pipeline, prefs.minScore, now, prefs.calendlyUrl);
  if (drafts.length) {
    await db()
      .insert(schema.checklistTasks)
      .values(drafts.map((d) => ({ ...d, userId, weekStart: week })))
      .onConflictDoNothing();
  }
  await ensureRoutines(userId, week);
  return listTasks(userId, now);
}

/** The same three habits every week, each on its own day (10:00 IST). Missed ones are not carried over: they come back next week. */
export const ROUTINES = [
  { kind: "routine_brief", day: 0, label: "Go through Monday's briefing and decide on the new events", detail: "Weekly routine" },
  { kind: "routine_followups", day: 2, label: "Send follow ups to people met at recent events", detail: "Weekly routine" },
  { kind: "routine_plan", day: 4, label: "Plan next week: pick the events worth attending", detail: "Weekly routine" },
] as const;

async function ensureRoutines(userId: string, week: string) {
  const have = await db()
    .select({ kind: schema.checklistTasks.kind })
    .from(schema.checklistTasks)
    .where(and(eq(schema.checklistTasks.userId, userId), eq(schema.checklistTasks.weekStart, week), inArray(schema.checklistTasks.kind, ROUTINES.map((r) => r.kind))));
  const missing = ROUTINES.filter((r) => !have.some((h) => h.kind === r.kind));
  if (!missing.length) return;
  const monday = zonedMidnight(week).getTime();
  await db()
    .insert(schema.checklistTasks)
    .values(missing.map((r) => ({ userId, weekStart: week, kind: r.kind, label: r.label, detail: r.detail, dueAt: new Date(monday + r.day * 86_400_000 + 10 * 3_600_000) })));
}

/** Vikram's own task or work meeting. It belongs to the week it is due in, so unfinished tasks carry forward. */
export async function addTask(userId: string, t: { kind: "task" | "meeting"; label: string; detail: string | null; dueAt: Date; eventId?: string | null }) {
  const [row] = await db()
    .insert(schema.checklistTasks)
    .values({ userId, weekStart: weekStart(t.dueAt), kind: t.kind, label: t.label, detail: t.detail, dueAt: t.dueAt, eventId: t.eventId ?? null })
    .returning();
  return row;
}

/** Only items Vikram added himself can be deleted; generated ones are just ticked. */
export async function deleteTask(userId: string, taskId: string) {
  const rows = await db()
    .delete(schema.checklistTasks)
    .where(and(eq(schema.checklistTasks.id, taskId), eq(schema.checklistTasks.userId, userId), inArray(schema.checklistTasks.kind, ["task", "meeting"])))
    .returning({ id: schema.checklistTasks.id });
  return rows.length > 0;
}

export async function listTasks(userId: string, now = new Date()) {
  return db()
    .select()
    .from(schema.checklistTasks)
    .where(and(eq(schema.checklistTasks.userId, userId), eq(schema.checklistTasks.weekStart, weekStart(now))))
    .orderBy(asc(schema.checklistTasks.done), sql`${schema.checklistTasks.dueAt} asc nulls last`, asc(schema.checklistTasks.createdAt));
}

export async function setTaskDone(userId: string, taskId: string, done: boolean) {
  const rows = await db()
    .update(schema.checklistTasks)
    .set({ done, doneAt: done ? new Date() : null })
    .where(and(eq(schema.checklistTasks.id, taskId), eq(schema.checklistTasks.userId, userId)))
    .returning({ id: schema.checklistTasks.id });
  return rows.length > 0;
}

/** Last week's checklist (for the "From last week" tab). */
export async function listTasksForWeek(userId: string, week: string) {
  return db()
    .select()
    .from(schema.checklistTasks)
    .where(and(eq(schema.checklistTasks.userId, userId), eq(schema.checklistTasks.weekStart, week)))
    .orderBy(asc(schema.checklistTasks.createdAt));
}
