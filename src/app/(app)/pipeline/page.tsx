import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeadlineText, placeLabel } from "@/components/events/event-card";
import { StatusControl } from "@/components/events/status-control";
import { renderOrError } from "@/components/shared/load";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/shared/ui";
import type { PipelineStatus } from "@/lib/db/schema";
import { TaskItem } from "@/components/checklist/task-item";
import { RecapList } from "@/components/today/recap-list";
import { recapPointers } from "@/lib/checklist/recap-pointers";
import { listTasks } from "@/lib/services/checklist";
import { type EventView, listPipelineEvents } from "@/lib/services/events";
import { type LastWeekRecap, lastWeekRecap } from "@/lib/services/recap";
import { getPreferences, getUser } from "@/lib/services/user";
import { formatDate, formatEventWhen, weekRangeLabel } from "@/lib/time";
import { hueFor } from "@/lib/ui/colors";

export const metadata: Metadata = { title: "My events" };

const LANES: { key: string; title: string; hint: string; statuses: PipelineStatus[]; accent: string; tint: string }[] = [
  { key: "going", title: "Going", hint: "Registered and upcoming", statuses: ["registered"], accent: "#1F5F4A", tint: "#E4EEE6" },
  { key: "register", title: "To register", hint: "You started, finish before the deadline", statuses: ["to_register"], accent: "#C2410C", tint: "#FDF1EA" },
  { key: "saved", title: "Saved", hint: "Worth a second look", statuses: ["saved"], accent: "#2A4A8A", tint: "#E3E9F5" },
  { key: "after", title: "After the event", hint: "Attended, follow up while it's fresh", statuses: ["attended", "follow_up_complete"], accent: "#5B3E96", tint: "#ECE6F6" },
];

export default function MyEventsPage() {
  return (
    <>
      <PageHeader
        title="My events"
        sub="Everything you've saved, are registering for, or are going to. You move events along, nothing changes on its own."
        actions={
          <Link href="/checklist" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-medium text-ink no-underline">
            This week&apos;s actions
          </Link>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Lanes />
      </Suspense>
    </>
  );
}

function Row({ e }: { e: EventView }) {
  const hue = hueFor(e.categories, e.title);
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-[18px] bg-surface p-3.5 pr-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:shadow-[var(--shadow-soft)]">
      <span className="flex w-14 shrink-0 flex-col items-center rounded-2xl py-2" style={{ background: hue.tint, color: hue.ink }}>
        <span className="text-[11px] font-semibold tracking-[0.06em]">{formatDate(e.startAt, { month: "short" }).toUpperCase()}</span>
        <span className="text-[22px] leading-none font-semibold">{formatDate(e.startAt, { day: "numeric" })}</span>
      </span>
      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <Link href={`/events/${e.id}`} className="font-medium text-ink no-underline hover:underline">
          {e.title}
        </Link>
        <span className="text-[13px] text-muted">
          {formatEventWhen(e.startAt, e.allDay)} · {placeLabel(e)}
        </span>
        <span className={`text-[12.5px] ${e.deadlineState.kind === "urgent" ? "font-medium text-urgent" : "text-faint"}`}>
          <DeadlineText e={e} />
        </span>
      </span>
      <StatusControl eventId={e.id} status={e.status} compact />
    </li>
  );
}

function LastWeek({ recap, calendlyUrl }: { recap: LastWeekRecap; calendlyUrl: string | null }) {
  const { carry, happened, followUps } = recap;
  const howDidItGo = happened.filter((e) => e.status === "registered" || e.status === "to_register" || e.status === "saved");
  const pending = carry.events.filter((c) => c.event.status !== "attended");
  const hasDetail = howDidItGo.length + pending.length + carry.tasks.length + followUps.length > 0;
  return (
    <section id="last-week" aria-labelledby="last-week-h" className="scroll-mt-6 rounded-[26px] bg-[#ECE6F6] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="last-week-h" className="font-serif text-[30px] leading-none text-[#3E2A6B]">
          From last week
        </h2>
        <span className="text-sm text-[#5B3E96]">{weekRangeLabel(recap.from, recap.to)} · picking up where you left off</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-[20px] bg-surface p-4">
          <p className="pb-1 text-xs font-semibold tracking-[0.06em] text-faint uppercase">Where things stand</p>
          <RecapList
            pointers={recapPointers({
              openActions: carry.tasks.length,
              halfRegistered: pending.filter((c) => c.event.status === "to_register").length,
              savedUndecided: pending.filter((c) => c.event.status === "saved").length,
              followUps: followUps.length,
              happened: howDidItGo.length,
              briefingSentAt: recap.briefingSentAt ? formatDate(recap.briefingSentAt, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : null,
              newSinceMonday: recap.newSinceMonday,
            })}
          />
        </div>
        <div className="flex flex-col gap-4">
          {!hasDetail && (
            <div className="rounded-[20px] bg-surface/70 p-4 text-sm leading-relaxed text-ink-2">
              Nothing from last week needs your attention. Events you save, register for or attend this week will show up here next Monday, so nothing slips through between weeks.
            </div>
          )}
          {howDidItGo.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-[#3E2A6B]">Your events last week · how did they go?</h3>
              <ul className="flex flex-col gap-2.5">
                {howDidItGo.map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </ul>
              <p className="text-xs text-[#5B3E96]">Set an event to Attended and a follow up reminder appears in this week&apos;s actions.</p>
            </div>
          )}
          {(pending.length > 0 || carry.tasks.length > 0) && (
            <div className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-[#3E2A6B]">Still pending</h3>
              {pending.length > 0 && (
                <ul className="flex flex-col gap-2.5">
                  {pending.map(({ event }) => (
                    <Row key={event.id} e={event} />
                  ))}
                </ul>
              )}
              {carry.tasks.length > 0 && (
                <ul className="rounded-[18px] bg-surface px-4 py-1">
                  {carry.tasks.map((t) => (
                    <TaskItem key={t.id} task={t} />
                  ))}
                </ul>
              )}
            </div>
          )}
          {followUps.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-[#3E2A6B]">Follow ups to send</h3>
              <ul className="flex flex-col gap-2.5">
                {followUps.map((e) => (
                  <Row key={e.id} e={e} />
                ))}
              </ul>
              {calendlyUrl && (
                <a href={calendlyUrl} target="_blank" rel="noopener noreferrer" className="text-sm">
                  Share your Calendly link with the people you met
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

async function Lanes() {
  await connection();
  return renderOrError(async () => {
    const now = new Date();
    const user = await getUser();
    const [events, prefs, tasks] = await Promise.all([listPipelineEvents(user.id, now), getPreferences(user.id), listTasks(user.id, now)]);
    const recap = await lastWeekRecap(user.id, events, tasks, now);
    const visible = events.filter((e) => e.status !== "dismissed");
    const dismissed = events.filter((e) => e.status === "dismissed");
    if (visible.length === 0) {
      return (
        <div className="flex flex-col gap-8">
          <LastWeek recap={recap} calendlyUrl={prefs.calendlyUrl} />
          <EmptyState title="Nothing saved yet.">
            Open <Link href="/dashboard">Today</Link> and decide on a few cards. Anything you save or register for shows up here.
          </EmptyState>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-8">
        <LastWeek recap={recap} calendlyUrl={prefs.calendlyUrl} />
        {LANES.map((lane) => {
          const list = visible.filter((e) => lane.statuses.includes(e.status) && (lane.key === "after" || e.startAt > new Date(now.getTime() - 86_400_000)));
          return (
            <section key={lane.key} aria-labelledby={`lane-${lane.key}`} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ background: lane.accent }} aria-hidden="true" />
                <h2 id={`lane-${lane.key}`} className="text-lg font-semibold">
                  {lane.title}
                </h2>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: lane.tint, color: lane.accent }}>
                  {list.length}
                </span>
                <span className="text-sm text-faint">{lane.hint}</span>
              </div>
              {list.length === 0 ? (
                <p className="rounded-[18px] border border-dashed border-line px-4 py-4 text-sm text-faint">Nothing here right now.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {list.map((e) => (
                    <Row key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {dismissed.length > 0 && (
          <details className="rounded-[18px] bg-surface/60 px-4 py-3">
            <summary className="cursor-pointer text-sm text-muted">Not for me ({dismissed.length}), hidden from Today and the briefing</summary>
            <ul className="mt-3 flex flex-col gap-2.5">
              {dismissed.map((e) => (
                <Row key={e.id} e={e} />
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  });
}
