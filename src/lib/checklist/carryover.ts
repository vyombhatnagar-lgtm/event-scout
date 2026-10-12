import type { EventView } from "@/lib/services/events";
import { zonedMidnight } from "@/lib/time";

export interface TaskLike {
  id: string;
  kind: string;
  eventId: string | null;
  label: string;
  detail: string | null;
  done: boolean;
}

export interface CarryOver<T extends TaskLike> {
  /** Last week's unticked actions that still matter and are not already on this week's list. */
  tasks: T[];
  /** Events Vikram parked before this week that are still undecided and upcoming. */
  events: { event: EventView; reason: string }[];
}

/**
 * What is still pending from last week:
 *  - unticked actions from last week's checklist, unless the event has passed, its registration
 *    closed, or the same action was carried into this week's list already;
 *  - events saved / marked "to register" before this week that are still upcoming and open;
 *  - events attended before this week that still need a follow up.
 */
export function carryOver<T extends TaskLike>(
  lastWeekTasks: T[],
  thisWeekTasks: TaskLike[],
  pipeline: EventView[],
  thisWeekStart: string,
  now: Date,
): CarryOver<T> {
  const weekBegins = zonedMidnight(thisWeekStart);
  const byId = new Map(pipeline.map((e) => [e.id, e]));
  const already = new Set(thisWeekTasks.map((t) => `${t.kind}:${t.eventId}`));

  const tasks = lastWeekTasks.filter((t) => {
    if (t.done || already.has(`${t.kind}:${t.eventId}`)) return false;
    // Meetings happened (or not) on their day, and routines come back every week: neither piles up.
    if (t.kind === "meeting" || t.kind.startsWith("routine")) return false;
    const e = t.eventId ? byId.get(t.eventId) : undefined;
    if (!e) return t.kind === "follow_up" || !t.eventId;
    if (t.kind === "follow_up") return e.status === "attended";
    if (e.status === "dismissed" || e.status === "registered") return false;
    return e.startAt > now && e.deadlineState.kind !== "closed";
  });

  const taskEvents = new Set(tasks.map((t) => t.eventId));
  const events = pipeline
    .filter((e) => e.statusUpdatedAt && e.statusUpdatedAt < weekBegins && !taskEvents.has(e.id))
    .flatMap((e) => {
      if ((e.status === "saved" || e.status === "to_register") && e.startAt > now && e.deadlineState.kind !== "closed") {
        return [{ event: e, reason: e.status === "to_register" ? "You started registering, not finished" : "Saved, still undecided" }];
      }
      if (e.status === "attended") return [{ event: e, reason: "Attended, follow up not done yet" }];
      return [];
    })
    .sort((a, b) => a.event.startAt.getTime() - b.event.startAt.getTime());

  return { tasks, events };
}
