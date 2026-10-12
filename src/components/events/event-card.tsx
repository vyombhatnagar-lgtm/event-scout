import Link from "next/link";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { Badge, CountdownRing, ScoreRing } from "@/components/shared/ui";
import type { EventView } from "@/lib/services/events";
import { formatDate, formatEventWhen } from "@/lib/time";
import { categoryLabel, hueFor } from "@/lib/ui/colors";
import { Chip, EventCover } from "./cover";
import { StatusControl } from "./status-control";

export function placeLabel(e: Pick<EventView, "format" | "city" | "venue">) {
  if (e.format === "online") return "Online";
  const parts = [e.city ?? "City not stated", e.format === "hybrid" ? "Hybrid" : null];
  return parts.filter(Boolean).join(" · ");
}

export function DeadlineText({ e }: { e: EventView }) {
  if (!e.deadline) return <span>Deadline unknown</span>;
  const when = formatDate(e.deadline, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <span>
      Closes {when} IST
      {e.deadlineOrigin === "ai_extracted" && <span className="text-faint"> (from event text)</span>}
      {e.deadlineConflict && <span className="text-urgent"> · sources disagree, earliest shown</span>}
    </span>
  );
}

export function DeadlineBadge({ e }: { e: EventView }) {
  const s = e.deadlineState;
  if (s.kind === "urgent") return <Badge tone="urgent">{s.label}</Badge>;
  if (s.kind === "closed") return <Badge tone="neutral">{e.registrationOpen ? "Deadline passed — source shows open" : "Registration closed"}</Badge>;
  return null;
}

export function SourceLinks({ e }: { e: EventView }) {
  if (e.sources.length === 0) return null;
  const freshest = new Date(Math.max(...e.sources.map((s) => s.retrievedAt.getTime())));
  return (
    <span className="text-xs text-faint">
      From{" "}
      {e.sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ", "}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-line underline-offset-2 hover:text-ink">
            {s.name}
          </a>
        </span>
      ))}{" "}
      · checked {formatDate(freshest, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
    </span>
  );
}

export function daysLeft(e: EventView): number | null {
  return e.deadlineState.kind === "urgent" || e.deadlineState.kind === "open" ? e.deadlineState.daysLeft : null;
}

/** Visual event card for grids (Explore, My events). */
export function EventCard({ e }: { e: EventView }) {
  const hue = hueFor(e.categories, e.title);
  const canRegister = e.registrationUrl && e.deadlineState.kind !== "closed";
  const dl = daysLeft(e);
  return (
    <article className="flex flex-col overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <EventCover image={e.imageUrl} hue={hue} seed={e.id} height={132}>
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Chip strong>{categoryLabel(e.categories)}</Chip>
          {e.score != null && e.aiScore == null && <Chip>Rules only</Chip>}
        </div>
        <div className="absolute top-3 right-3">
          <ScoreRing score={e.score} size={52} />
        </div>
      </EventCover>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-serif text-[24px] leading-[1.12]">
          <Link href={`/events/${e.id}`} className="text-ink no-underline hover:underline hover:decoration-1 hover:underline-offset-4">
            {e.title}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon />
            {formatEventWhen(e.startAt, e.allDay)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PinIcon />
            {placeLabel(e)}
          </span>
        </div>
        {(e.reason || e.summary) && <p className="line-clamp-3 text-sm leading-relaxed text-ink-2">{e.reason ?? e.summary}</p>}
        <div className="mt-auto flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: e.deadlineState.kind === "urgent" ? "var(--urgent-soft)" : "#F6F4EF" }}>
          <CountdownRing daysLeft={dl} size={36} label={e.deadlineState.kind === "closed" ? "✕" : undefined} />
          <span className="flex min-w-0 flex-col text-[13px]">
            <span className={`font-semibold ${e.deadlineState.kind === "urgent" ? "text-urgent" : "text-ink-2"}`}>
              {e.deadlineState.kind === "unknown" ? "Deadline unknown" : e.deadlineState.kind === "closed" ? "Registration closed" : e.deadlineState.label}
            </span>
            <span className="truncate text-faint">{e.deadline ? <DeadlineText e={e} /> : "Not stated by the organiser"}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRegister && (
            <a href={e.registrationUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-xl px-3.5 text-[13px] font-semibold text-white no-underline hover:text-white" style={{ background: hue.ink }}>
              Register
            </a>
          )}
          <StatusControl eventId={e.id} status={e.status} compact />
          <AddToCalendar e={e} />
        </div>
        <SourceLinks e={e} />
      </div>
    </article>
  );
}

export function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
