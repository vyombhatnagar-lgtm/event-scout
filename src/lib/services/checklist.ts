import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { draftWeeklyTasks } from "@/lib/checklist/generate";
import { db, schema } from "@/lib/db/client";
import { weekStart } from "@/lib/time";
import type { Preferences } from "@/types/preferences";
import { listPipelineEvents, listWindowEvents } from "./events";

/** Add any newly-relevant tasks for this week; existing tasks (and their done state) are kept. */
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
  return listTasks(userId, now);
}

export async function listTasks(userId: string, now = new Date()) {
  return db()
    .select()
    .from(schema.checklistTasks)
    .where(and(eq(schema.checklistTasks.userId, userId), eq(schema.checklistTasks.weekStart, weekStart(now))))
    .orderBy(asc(schema.checklistTasks.done), asc(schema.checklistTasks.createdAt));
}

export async function setTaskDone(userId: string, taskId: string, done: boolean) {
  const rows = await db()
    .update(schema.checklistTasks)
    .set({ done, doneAt: done ? new Date() : null })
    .where(and(eq(schema.checklistTasks.id, taskId), eq(schema.checklistTasks.userId, userId)))
    .returning({ id: schema.checklistTasks.id });
  return rows.length > 0;
}
