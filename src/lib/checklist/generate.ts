import type { EventView } from "@/lib/services/events";
import { DAY_MS, formatDate } from "@/lib/time";

export interface TaskDraft {
  eventId: string;
  kind: "register" | "review" | "prepare" | "follow_up";
  label: string;
  detail: string | null;
}

const short = (d: Date) => formatDate(d, { weekday: "short", day: "numeric", month: "short" });

/**
 * Derive this week's actions from real events and pipeline state only.
 * No event, no task — nothing is generated just to fill the list.
 */
export function draftWeeklyTasks(
  windowEvents: EventView[],
  pipeline: EventView[],
  minScore: number,
  now: Date,
  calendlyUrl: string | null,
): TaskDraft[] {
  const tasks: TaskDraft[] = [];
  const inPipeline = new Set(pipeline.map((e) => e.id));

  for (const e of pipeline) {
    const ds = e.deadlineState;
    const startsIn = e.startAt.getTime() - now.getTime();
    if ((e.status === "saved" || e.status === "to_register") && startsIn > 0) {
      if (ds.kind === "urgent") {
        tasks.push({ eventId: e.id, kind: "register", label: `Register: ${e.title}`, detail: `${ds.label} (${short(e.deadline!)})` });
      } else if (e.status === "to_register" && ds.kind !== "closed") {
        tasks.push({ eventId: e.id, kind: "register", label: `Register: ${e.title}`, detail: ds.kind === "unknown" ? "Deadline unknown — check the event page" : ds.label });
      }
    }
    if (e.status === "registered" && startsIn > 0 && startsIn <= 7 * DAY_MS) {
      tasks.push({ eventId: e.id, kind: "prepare", label: `Prepare for ${e.title}`, detail: `Event ${short(e.startAt)} — review attendees and plan who to meet` });
    }
    if (e.status === "attended") {
      tasks.push({
        eventId: e.id,
        kind: "follow_up",
        label: `Follow up after ${e.title}`,
        detail: calendlyUrl ? "Send your Calendly link to the people you met" : "Message the people you met",
      });
    }
  }

  // Top new recommendations worth a decision this week.
  const fresh = windowEvents
    .filter((e) => !inPipeline.has(e.id) && e.score != null && e.score >= minScore && e.deadlineState.kind !== "closed")
    .slice(0, 3);
  for (const e of fresh) {
    tasks.push({
      eventId: e.id,
      kind: "review",
      label: `Decide on ${e.title}`,
      detail: `Fit ${e.score} · ${short(e.startAt)}${e.deadlineState.kind === "urgent" ? ` · ${e.deadlineState.label}` : ""}`,
    });
  }
  return tasks;
}
