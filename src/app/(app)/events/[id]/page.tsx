import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCalendar } from "@/components/calendar/add-to-calendar";
import { Chip, EventCover } from "@/components/events/cover";
import { CalendarIcon, DeadlineText, PinIcon, SourceLinks, daysLeft, placeLabel } from "@/components/events/event-card";
import { StatusControl } from "@/components/events/status-control";
import { renderOrError } from "@/components/shared/load";
import { Card, CountdownRing, PageSkeleton, ScoreRing } from "@/components/shared/ui";
import { getEvent } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";
import { formatDate, formatEventWhen } from "@/lib/time";
import { categoryLabel, hueFor } from "@/lib/ui/colors";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <>
      <Link href="/events" className="-mb-3 text-sm text-muted no-underline hover:text-ink">
        ← Explore
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
        <Card className="p-8 text-center">
          <h1 className="font-serif text-3xl">Event not found</h1>
          <p className="mt-2 text-sm text-muted">
            It may have been removed from its source. <Link href="/events">Back to Explore</Link>
          </p>
        </Card>
      );
    }
    const hue = hueFor(e.categories, e.title);
    const row = (k: string, v: React.ReactNode) => (
      <div className="flex flex-col gap-0.5 border-t border-line-2 py-3.5 first:border-t-0 sm:flex-row sm:gap-6">
        <dt className="w-44 shrink-0 text-[13px] text-muted">{k}</dt>
        <dd className="text-sm">{v}</dd>
      </div>
    );
    const unknown = <span className="text-faint">Not stated by the source</span>;
    const urgent = e.deadlineState.kind === "urgent";
    return (
      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-soft)]">
          <EventCover image={e.imageUrl} hue={hue} seed={e.id} height={240}>
            <div className="absolute top-5 left-6 flex flex-wrap gap-2">
              {e.categories.map((c) => (
                <Chip key={c} strong>
                  {categoryLabel([c])}
                </Chip>
              ))}
            </div>
            <div className="absolute top-5 right-6">
              <ScoreRing score={e.score} size={70} />
            </div>
          </EventCover>
          <div className="flex flex-col gap-4 px-6 pt-6 pb-7 sm:px-8">
            <h1 className="font-serif text-[clamp(32px,4.4vw,46px)] leading-[1.05]">{e.title}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink-2">
              <span className="inline-flex items-center gap-2">
                <CalendarIcon />
                {formatEventWhen(e.startAt, e.allDay)}
                {e.endAt ? ` → ${formatEventWhen(e.endAt, e.allDay)}` : ""}
              </span>
              <span className="inline-flex items-center gap-2">
                <PinIcon />
                {placeLabel(e)}
                {e.venue ? ` · ${e.venue}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {e.registrationUrl && e.deadlineState.kind !== "closed" && (
                <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-2xl px-6 text-[15px] font-semibold text-white no-underline hover:text-white hover:opacity-90" style={{ background: hue.ink }}>
                  Register on {e.sources[0]?.name ?? "the event site"}
                </a>
              )}
              <a href={e.eventUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-2xl border border-line bg-surface px-5 text-sm font-medium text-ink no-underline">
                Event page
              </a>
              <AddToCalendar e={e} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
            {(e.reason || e.summary) && (
              <Card className="flex flex-col gap-3 p-6" >
                {e.reason && (
                  <p className="font-serif text-[22px] leading-snug">
                    <span className="text-faint">Why it fits — </span>
                    {e.reason}
                  </p>
                )}
                {e.summary && <p className="text-[15px] leading-relaxed text-ink-2">{e.summary}</p>}
              </Card>
            )}
            <Card className="px-6 py-2">
              <dl>
                {row("Organiser", e.organiser ?? unknown)}
                {row("Audience", e.audience ?? unknown)}
                {row("Price", e.priceText ?? unknown)}
                {row("Registration", e.registrationOpen == null ? <span className="text-faint">Status not stated by the source</span> : e.registrationOpen ? "Open on the source at last check" : "Not open on the source at last check")}
                {row("Found on", <SourceLinks e={e} />)}
                {row("Last verified", `${formatDate(e.lastVerifiedAt, { dateStyle: "medium", timeStyle: "short" })} IST`)}
              </dl>
            </Card>
            {e.description && (
              <section aria-labelledby="desc-h" className="flex flex-col gap-2 px-1">
                <h2 id="desc-h" className="text-[17px] font-semibold">
                  From the organiser
                </h2>
                <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{e.description}</p>
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
            <Card className="flex flex-col gap-3 p-5" >
              <div className="flex items-center gap-3.5 rounded-2xl p-3" style={{ background: urgent ? "var(--urgent-soft)" : "#F6F4EF" }}>
                <CountdownRing daysLeft={daysLeft(e)} size={52} label={e.deadlineState.kind === "closed" ? "✕" : undefined} />
                <span className="flex flex-col">
                  <span className={`font-semibold ${urgent ? "text-urgent" : "text-ink"}`}>
                    {e.deadlineState.kind === "unknown" ? "Deadline unknown" : e.deadlineState.kind === "closed" ? "Registration closed" : e.deadlineState.label}
                  </span>
                  <span className="text-[13px] text-muted">{e.deadline ? <DeadlineText e={e} /> : "Not stated by the organiser"}</span>
                </span>
              </div>
              {e.deadlineEvidence && <p className="text-xs text-faint">Source text: &ldquo;{e.deadlineEvidence}&rdquo;</p>}
            </Card>
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="text-base font-semibold">Your status</h2>
              <StatusControl eventId={e.id} status={e.status} />
              <p className="text-xs text-faint">You set this yourself — registering on the event site doesn&apos;t change it automatically.</p>
            </Card>
            <Card className="p-5 text-sm text-ink-2">
              <h2 className="mb-1.5 text-base font-semibold text-ink">How the score works</h2>
              {e.score == null ? (
                "Not scored yet."
              ) : (
                <>
                  Fit {e.score}: your preferences (rules) {e.ruleScore}
                  {e.aiScore != null ? `, Gemini Flash ${e.aiScore}` : " — Gemini assessment pending"}.
                </>
              )}
            </Card>
          </aside>
        </div>
      </div>
    );
  });
}
