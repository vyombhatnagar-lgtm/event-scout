import { googleCalendarUrl } from "@/lib/calendar/ics";
import { toCalendarEvent } from "@/lib/calendar/from-event";
import type { EventView } from "@/lib/services/events";

/** Two no-sign-in options: Google Calendar link and a .ics download (Outlook, Apple, any calendar). */
export function AddToCalendar({ e }: { e: EventView }) {
  const withDeadline = e.deadline && e.deadlineState.kind !== "closed";
  return (
    <details className="relative">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-md border border-[#d5d8d1] bg-surface px-3 text-[13px] font-medium hover:border-ink-2">
        Add to calendar
      </summary>
      <div className="absolute z-10 mt-1 flex w-60 flex-col rounded-md border border-line bg-surface p-1 text-sm shadow-lg">
        <a href={googleCalendarUrl(toCalendarEvent(e))} target="_blank" rel="noopener noreferrer" className="rounded px-3 py-2 text-ink no-underline hover:bg-line-2">
          Google Calendar
        </a>
        <a href={`/api/events/${e.id}/ics`} className="rounded px-3 py-2 text-ink no-underline hover:bg-line-2">
          Outlook / Apple (.ics){withDeadline ? " + deadline reminder" : ""}
        </a>
      </div>
    </details>
  );
}
