import { googleCalendarUrl } from "@/lib/calendar/ics";
import { toCalendarEvent } from "@/lib/calendar/from-event";
import type { EventView } from "@/lib/services/events";

/** Two no-sign-in options: Google Calendar link and a .ics download (Outlook, Apple, any calendar). */
export function AddToCalendar({ e }: { e: EventView }) {
  const withDeadline = e.deadline && e.deadlineState.kind !== "closed";
  return (
    <details className="group relative">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium transition hover:border-faint [&::-webkit-details-marker]:hidden">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18M12 13v5M9.5 15.5h5" />
        </svg>
        Calendar
      </summary>
      <div className="absolute z-20 mt-1.5 flex w-64 flex-col rounded-2xl bg-surface p-1.5 text-sm shadow-[var(--shadow-lift)]">
        <a href={googleCalendarUrl(toCalendarEvent(e))} target="_blank" rel="noopener noreferrer" className="rounded-xl px-3 py-2.5 text-ink no-underline hover:bg-line-2">
          Google Calendar
        </a>
        <a href={`/api/events/${e.id}/ics`} className="rounded-xl px-3 py-2.5 text-ink no-underline hover:bg-line-2">
          Outlook / Apple (.ics)
          {withDeadline && <span className="block text-xs text-faint">includes a “registration closes” reminder</span>}
        </a>
      </div>
    </details>
  );
}
