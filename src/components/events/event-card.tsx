import Link from "next/link";
import { Badge, ScoreRing } from "@/components/shared/ui";
import type { EventView } from "@/lib/services/events";
import { formatDate, formatEventWhen } from "@/lib/time";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { StatusControl } from "./status-control";

export function placeLabel(e: Pick<EventView, "format" | "city" | "venue">) {
  if (e.format === "online") return "Online";
  const parts = [e.city ?? "City not stated", e.format === "hybrid" ? "Hybrid" : e.format === "in_person" ? "In person" : null];
  return parts.filter(Boolean).join(" · ");
}

export function DeadlineText({ e }: { e: EventView }) {
  if (!e.deadline) return <span>Deadline unknown</span>;
  const when = formatDate(e.deadline, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <span>
      Registration closes {when} IST
      {e.deadlineOrigin === "ai_extracted" && <span className="text-muted"> (from event text)</span>}
      {e.deadlineConflict && <span className="text-urgent"> · sources disagree, earliest shown</span>}
    </span>
  );
}

export function DeadlineBadge({ e }: { e: EventView }) {
  const s = e.deadlineState;
  if (s.kind === "urgent") return <Badge tone="urgent">{s.label}</Badge>;
  if (s.kind === "closed") return <Badge tone="neutral">{e.registrationOpen ? "Deadline passed — source shows open" : "Deadline passed"}</Badge>;
  return null;
}

export function SourceLinks({ e }: { e: EventView }) {
  if (e.sources.length === 0) return null;
  const freshest = new Date(Math.max(...e.sources.map((s) => s.retrievedAt.getTime())));
  return (
    <span className="text-xs text-muted">
      Source:{" "}
      {e.sources.map((s, i) => (
        <span key={s.url}>
          {i > 0 && ", "}
          <a href={s.url} target="_blank" rel="noopener noreferrer">
            {s.name}
          </a>
        </span>
      ))}{" "}
      · checked {formatDate(freshest, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
    </span>
  );
}

export function EventCard({ e }: { e: EventView }) {
  const canRegister = e.registrationUrl && e.deadlineState.kind !== "closed";
  return (
    <article className="flex gap-4 rounded-lg border border-line bg-surface p-5 sm:gap-5">
      <div className="shrink-0">
        <ScoreRing score={e.score} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {e.categories.slice(0, 2).map((c) => (
            <Badge key={c} tone="accent">
              {c}
            </Badge>
          ))}
          {e.status !== "discovered" && <Badge>{e.status.replace(/_/g, " ")}</Badge>}
          <DeadlineBadge e={e} />
          {e.score != null && e.aiScore == null && (
            <Badge tone="warn" title="Gemini has not assessed this event yet (quota or availability); the score uses the deterministic rules only">
              Rules only · AI pending
            </Badge>
          )}
        </div>
        <h3 className="text-[17px] leading-snug font-semibold">
          <Link href={`/events/${e.id}`} className="text-ink no-underline hover:underline">
            {e.title}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          <span>{formatEventWhen(e.startAt, e.allDay)}</span>
          <span>{placeLabel(e)}</span>
          <DeadlineText e={e} />
        </div>
        {(e.reason || e.summary) && (
          <p className="text-sm leading-relaxed text-ink-2">
            {e.reason ? (
              <>
                <strong className="font-semibold text-ink">Why it fits: </strong>
                {e.reason}
              </>
            ) : (
              e.summary
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canRegister && (
            <a href={e.registrationUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-md bg-accent px-3.5 text-[13px] font-semibold text-white no-underline hover:bg-accent-ink hover:text-white">
              Register
            </a>
          )}
          <StatusControl eventId={e.id} status={e.status} compact />
          <AddToCalendar e={e} />
          <span className="basis-full sm:ml-auto sm:basis-auto">
            <SourceLinks e={e} />
          </span>
        </div>
      </div>
    </article>
  );
}
