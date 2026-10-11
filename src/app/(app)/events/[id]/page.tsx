import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeadlineBadge, DeadlineText, SourceLinks, placeLabel } from "@/components/events/event-card";
import { StatusControl } from "@/components/events/status-control";
import { renderOrError } from "@/components/shared/load";
import { Badge, Card, PageSkeleton, ScoreRing } from "@/components/shared/ui";
import { getEvent } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";
import { formatDate, formatEventWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <>
      <Link href="/events" className="text-sm">
        ← All events
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <EventDetail params={params} />
      </Suspense>
    </>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return renderOrError(async () => {
    const user = await getUser();
    const e = await getEvent(user.id, id);
    if (!e) {
      return (
        <Card className="p-6">
          <h1 className="font-semibold">Event not found</h1>
          <p className="mt-2 text-sm text-muted">It may have been removed from its source. <Link href="/events">Back to events</Link></p>
        </Card>
      );
    }
    const row = (k: string, v: React.ReactNode) => (
      <div className="flex flex-col gap-0.5 border-t border-line-2 py-3 sm:flex-row sm:gap-6">
        <dt className="w-44 shrink-0 text-[13px] text-muted">{k}</dt>
        <dd className="text-sm">{v}</dd>
      </div>
    );
    const unknown = <span className="text-muted">Not stated by source</span>;
    return (
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {e.categories.map((c) => (
              <Badge key={c} tone="accent">
                {c}
              </Badge>
            ))}
            <DeadlineBadge e={e} />
          </div>
          <h1 className="text-[28px] leading-tight font-semibold">{e.title}</h1>
          <div className="flex flex-wrap gap-2">
            {e.registrationUrl && e.deadlineState.kind !== "closed" && (
              <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-ink hover:text-white">
                Register on {e.sources[0]?.name ?? "event site"}
              </a>
            )}
            <a href={e.eventUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-md border border-[#d5d8d1] bg-surface px-4 text-sm font-medium text-ink no-underline">
              Open event page
            </a>
          </div>
          {e.summary && <p className="text-[15px] leading-relaxed text-ink-2">{e.summary}</p>}
          <Card className="px-5 pb-2">
            <dl>
              {row("When", formatEventWhen(e.startAt, e.allDay) + (e.endAt ? ` → ${formatEventWhen(e.endAt, e.allDay)}` : ""))}
              {row("Where", <>{placeLabel(e)}{e.venue ? ` · ${e.venue}` : ""}</>)}
              {row("Registration deadline", <><DeadlineText e={e} />{e.deadlineEvidence && <span className="mt-1 block text-xs text-muted">Evidence: &ldquo;{e.deadlineEvidence}&rdquo;</span>}</>)}
              {row("Registration", e.registrationOpen == null ? <span className="text-muted">Status not stated by source</span> : e.registrationOpen ? "Open on source (at last check)" : "Not open on source (at last check)")}
              {row("Organiser", e.organiser ?? unknown)}
              {row("Audience", e.audience ?? unknown)}
              {row("Price", e.priceText ?? unknown)}
              {row("Sources", <SourceLinks e={e} />)}
              {row("Last verified", formatDate(e.lastVerifiedAt, { dateStyle: "medium", timeStyle: "short" }) + " IST")}
            </dl>
          </Card>
          {e.description && (
            <section aria-labelledby="desc-h" className="flex flex-col gap-2">
              <h2 id="desc-h" className="text-[17px] font-semibold">
                Description from source
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{e.description}</p>
            </section>
          )}
        </div>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-4">
              <ScoreRing score={e.score} size={64} />
              <div className="text-sm text-ink-2">
                {e.score == null ? "Not scored yet." : <>Rules {e.ruleScore} · Gemini {e.aiScore ?? "pending"}</>}
              </div>
            </div>
            {e.reason && <p className="text-sm leading-relaxed text-ink-2"><strong className="text-ink">Why it fits:</strong> {e.reason}</p>}
            <div className="border-t border-line-2 pt-4">
              <StatusControl eventId={e.id} status={e.status} />
              <p className="mt-2 text-xs text-muted">Status changes only when you set it. Registering on the event site does not update it automatically.</p>
            </div>
          </Card>
        </aside>
      </div>
    );
  });
}
