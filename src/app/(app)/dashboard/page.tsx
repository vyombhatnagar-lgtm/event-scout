import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { daysLeft, placeLabel } from "@/components/events/event-card";
import { TaskItem } from "@/components/checklist/task-item";
import { renderOrError } from "@/components/shared/load";
import { CountdownRing, Notice, PageSkeleton } from "@/components/shared/ui";
import { type DayCell, type DeckItem, TodayDeck } from "@/components/today/today-deck";
import { WeekGlance } from "@/components/today/week-glance";
import { WeekTabs } from "@/components/today/week-tabs";
import { recapPointers } from "@/lib/checklist/recap-pointers";
import { lastWeekRecap } from "@/lib/services/recap";
import { toCalendarEvent } from "@/lib/calendar/from-event";
import { googleCalendarUrl } from "@/lib/calendar/ics";
import { syncWeeklyTasks } from "@/lib/services/checklist";
import { type EventView, latestSourceRuns, listPipelineEvents, listWindowEvents } from "@/lib/services/events";
import { getPreferences, getUser } from "@/lib/services/user";
import { DAY_MS, formatDate, formatEventWhen, localDate, weekRangeLabel } from "@/lib/time";
import { categoryLabel, hueFor } from "@/lib/ui/colors";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Today />
    </Suspense>
  );
}

function greeting(d: Date) {
  const h = Number(formatDate(d, { hour: "2-digit", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function deadlineCopy(e: EventView): { title: string; sub: string } {
  const s = e.deadlineState;
  if (s.kind === "unknown") return { title: "Deadline unknown", sub: "Not stated by the organiser, register early to be safe" };
  const when = formatDate(e.deadline!, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const origin = e.deadlineOrigin === "ai_extracted" ? " (from the event text)" : "";
  if (s.kind === "closed") return { title: "Registration closed", sub: `Closed ${when} IST` };
  return { title: s.label, sub: `Registration closes ${when} IST${origin}` };
}

function toDeckItem(e: EventView): DeckItem {
  const hue = hueFor(e.categories, e.title);
  const d = deadlineCopy(e);
  return {
    id: e.id,
    title: e.title,
    when: formatEventWhen(e.startAt, e.allDay),
    where: [placeLabel(e), e.venue && e.format !== "online" ? e.venue.slice(0, 60) : null].filter(Boolean).join(" · "),
    why: e.reason ?? e.summary,
    fit: e.score,
    rulesOnly: e.aiScore == null,
    category: e.categories.length ? categoryLabel(e.categories) : (e.city ?? placeLabel(e)),
    hue: { tint: hue.tint, shape: hue.shape, ink: hue.ink },
    image: e.imageUrl,
    day: localDate(e.startAt),
    daysLeft: daysLeft(e),
    deadlineTitle: d.title,
    deadlineSub: d.sub,
    registrationUrl: e.registrationUrl,
    gcalUrl: googleCalendarUrl(toCalendarEvent(e)),
    icsUrl: `/api/events/${e.id}/ics`,
    source: e.sources.length > 1 ? `${e.sources.length} sources` : (e.sources[0]?.name ?? "Source"),
  };
}

async function Today() {
  await connection();
  return renderOrError(async () => {
    const now = new Date();
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const [events, pipeline, tasks, runs] = await Promise.all([
      listWindowEvents(user.id, now),
      listPipelineEvents(user.id, now),
      syncWeeklyTasks(user.id, prefs, now),
      latestSourceRuns(),
    ]);
    const recap = await lastWeekRecap(user.id, pipeline, tasks, now);
    const carry = recap.carry;

    const live = events.filter((e) => e.status !== "dismissed");
    const relevant = live.filter((e) => e.score != null && e.score >= prefs.minScore && e.deadlineState.kind !== "closed");
    // Deck: undecided relevant events, best fit first, with a boost when registration closes within a week.
    const priority = (e: EventView) => (e.score ?? 0) + (e.deadlineState.kind === "urgent" ? 12 : 0);
    const deck = relevant
      .filter((e) => e.status === "discovered")
      .sort((a, b) => priority(b) - priority(a) || a.startAt.getTime() - b.startAt.getTime())
      .slice(0, 25);
    const closing = live
      .filter((e) => e.deadlineState.kind === "urgent" && ((e.score ?? 0) >= prefs.minScore || ["saved", "to_register"].includes(e.status)))
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
    const going = pipeline.filter((e) => e.status === "registered" && e.startAt > now);

    // Two week strip with a coloured dot per relevant event (strong fits in the category's deep colour).
    const today = localDate(now);
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days: DayCell[] = Array.from({ length: 14 }, (_, k) => {
      const key = localDate(new Date(now.getTime() + k * DAY_MS));
      const [y, m, dd] = key.split("-").map(Number);
      const dots = relevant
        .filter((e) => localDate(e.startAt) === key)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((e) => {
          const h = hueFor(e.categories, e.title);
          return (e.score ?? 0) >= 75 ? h.ink : h.shape;
        });
      return { key, num: dd, dow: dows[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()], dots, isToday: key === today };
    });

    const brief =
      relevant.length === 0
        ? "Nothing new above your bar today, enjoy the quiet."
        : `${relevant.length} rooms are worth your time this month${closing.length ? `, and ${closing.length} close${closing.length === 1 ? "s" : ""} within a week` : ""}.`;

    const lastRun = runs.rows.map((r) => r.finished_at).filter(Boolean).sort().at(-1);
    const failing = runs.rows.filter((r) => r.status === "failed");

    return (
      <>
        <section aria-label="Your brief" className="flex flex-col gap-2.5">
          <span className="text-sm text-muted">{formatDate(now, { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 className="max-w-[880px] font-serif text-[clamp(34px,5vw,54px)] leading-[1.04] font-normal tracking-[-0.01em]">
            {greeting(now)}, Vikram. <span className="text-faint">{brief}</span>
          </h1>
        </section>

        {prefs.isDefault && (
          <Notice>
            <span>
              You&apos;re on the starter preferences ({prefs.cities.join(", ")}). <Link href="/settings">Tune them</Link> any time, results update immediately.
            </span>
          </Notice>
        )}
        {failing.length > 0 && (
          <Notice tone="urgent">
            <span>
              {failing.map((f) => f.source_name).join(", ")} could not be reached this morning; everything else is up to date. <Link href="/status">Details</Link>
            </span>
          </Notice>
        )}

        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="Decide" className="min-w-0 flex-[999_1_540px]">
            <TodayDeck items={deck.map(toDeckItem)} days={days} />
            <div className="mt-6">
              <WeekGlance now={now} events={[...events, ...pipeline.filter((p) => !events.some((e) => e.id === p.id))]} minScore={prefs.minScore} items={tasks.filter((t) => t.dueAt && (t.kind === "meeting" || t.kind === "task" || t.kind.startsWith("routine"))).map((t) => ({ id: t.id, label: t.label, kind: t.kind, dueAt: t.dueAt!, done: t.done }))} />
            </div>
          </section>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            {carry.tasks.length + carry.events.length > 0 && (
              <section aria-labelledby="pending-h" className="rounded-[22px] border-2 border-[#F0C9B0] bg-[#FFF8F3] p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 id="pending-h" className="text-base font-semibold text-urgent">
                    Pending from last week
                  </h2>
                  <span className="text-[12.5px] text-[#9A4A20]">{carry.tasks.length + carry.events.length} carried over</span>
                </div>
                <p className="mt-1 text-[13px] text-muted">Finish these before moving on to this week&apos;s list.</p>
                <ul className="mt-1 flex flex-col">
                  {carry.tasks.slice(0, 2).map((t) => (
                    <TaskItem key={t.id} task={t} carried />
                  ))}
                  {carry.tasks.length < 2 &&
                    carry.events.slice(0, 2 - carry.tasks.length).map(({ event: e, reason }) => (
                      <li key={e.id} className="border-t border-line-2 py-3 text-sm first:border-t-0">
                        <Link href={`/events/${e.id}`} className="font-medium text-ink no-underline hover:underline">
                          {e.title}
                        </Link>
                        <span className="block text-xs text-faint">{reason}</span>
                      </li>
                    ))}
                </ul>
                {carry.tasks.length + carry.events.length > 2 && (
                  <Link href="/pipeline#last-week" className="text-sm">
                    +{carry.tasks.length + carry.events.length - 2} more from last week
                  </Link>
                )}
              </section>
            )}
            <section aria-labelledby="soon-h" className="rounded-[22px] bg-surface p-5 shadow-[var(--shadow-soft)]">
              <h2 id="soon-h" className="mb-3.5 text-base font-semibold">
                Closing soon
              </h2>
              {closing.length === 0 ? (
                <p className="text-sm text-muted">No stated deadlines close in the next 7 days.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {closing.slice(0, 5).map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <CountdownRing daysLeft={daysLeft(e)} />
                      <span className="flex min-w-0 flex-col">
                        <Link href={`/events/${e.id}`} className="truncate text-sm font-medium text-ink no-underline hover:underline">
                          {e.title}
                        </Link>
                        <span className="text-[12.5px] text-muted">
                          {formatDate(e.deadline!, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} · {e.city ?? placeLabel(e)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="going-h" className="rounded-[22px] bg-night p-5 text-[#F4F2ED]">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 id="going-h" className="text-base font-semibold">
                  You&apos;re going
                </h2>
                <span className="text-[12.5px] text-[#A9AD9F]">{going.length} upcoming</span>
              </div>
              {going.length === 0 ? (
                <p className="text-sm text-[#C9CCC0]">Nothing confirmed yet. Register for a card on the left and it lands here.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {going.slice(0, 4).map((e) => (
                    <li key={e.id} className="flex items-center gap-3.5">
                      <span className="flex w-12 flex-col items-center rounded-xl bg-night-2 py-1.5">
                        <span className="text-[11px] tracking-[0.06em] text-[#A9AD9F]">{formatDate(e.startAt, { month: "short" }).toUpperCase()}</span>
                        <span className="text-xl font-semibold">{formatDate(e.startAt, { day: "numeric" })}</span>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <Link href={`/events/${e.id}`} className="truncate text-sm font-medium text-[#F4F2ED] no-underline hover:text-white hover:underline">
                          {e.title}
                        </Link>
                        <span className="text-[12.5px] text-[#A9AD9F]">
                          {formatDate(e.startAt, { weekday: "short" })} · {e.city ?? placeLabel(e)}
                          {e.startAt.getTime() - now.getTime() < 7 * DAY_MS ? " · this week" : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {prefs.calendlyUrl && (
                <a href={prefs.calendlyUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-[13.5px] text-[#CFE6DA] hover:text-white">
                  Book follow ups on Calendly →
                </a>
              )}
            </section>

            <WeekTabs
              thisWeek={tasks}
              lastWeek={carry.tasks}
              carried={carry.events.map(({ event: e, reason }) => ({
                id: e.id,
                title: e.title,
                when: formatEventWhen(e.startAt, e.allDay),
                reason,
                deadline: e.deadline && e.deadlineState.kind !== "closed" ? `Registration closes ${formatDate(e.deadline, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}` : null,
                urgent: e.deadlineState.kind === "urgent",
                color: hueFor(e.categories, e.title).ink,
              }))}
              range={weekRangeLabel(recap.from, recap.to)}
              pointers={recapPointers({
                openActions: carry.tasks.length,
                halfRegistered: carry.events.filter((c) => c.event.status === "to_register").length,
                savedUndecided: carry.events.filter((c) => c.event.status === "saved").length,
                followUps: recap.followUps.length,
                happened: recap.happened.filter((e) => e.status === "registered").length,
                briefingSentAt: recap.briefingSentAt ? formatDate(recap.briefingSentAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : null,
                newSinceMonday: recap.newSinceMonday,
              })}
            />

            <p className="flex items-center gap-2 px-1.5 text-[13px] text-muted">
              <span className={`size-2 rounded-full ${failing.length ? "bg-urgent" : "bg-ok"}`} aria-hidden="true" />
              {events.length} events from {runs.rows.length} sources
              {lastRun ? ` · updated ${formatDate(new Date(lastRun), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}` : ""}
            </p>
          </aside>
        </div>

      </>
    );
  });
}
