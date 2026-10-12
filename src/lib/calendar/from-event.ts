import type { EventView } from "@/lib/services/events";
import type { CalendarEvent } from "./ics";

export function toCalendarEvent(e: EventView): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    location: e.format === "online" ? "Online" : [e.venue, e.city].filter(Boolean).join(", ") || null,
    url: e.registrationUrl ?? e.eventUrl,
    sourceUrl: e.sources[0]?.url ?? null,
    summary: e.summary,
    deadline: e.deadline && e.deadlineState.kind !== "closed" ? e.deadline : null,
  };
}
