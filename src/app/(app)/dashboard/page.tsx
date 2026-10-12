import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { TaskItem } from "@/components/checklist/task-item";
import { EventCard, placeLabel } from "@/components/events/event-card";
import { STATUS_LABELS } from "@/components/events/status-control";
import { JobButton } from "@/components/shared/job-button";
import { renderOrError } from "@/components/shared/load";
import { Badge, Card, EmptyState, Notice, PageHeader, PageSkeleton, SectionTitle, Stat } from "@/components/shared/ui";
import type { PipelineStatus } from "@/lib/db/schema";
import { syncWeeklyTasks } from "@/lib/services/checklist";
import { latestSourceRuns, listPipelineEvents, listWindowEvents } from "@/lib/services/events";
import { getPreferences, getUser } from "@/lib/services/user";
import { DAY_MS, formatDate, formatEventWhen, weekStart } from "@/lib/time";
import { SourceTable } from "@/components/status/source-table";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
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

    const relevant = events.filter((e) => e.score != null && e.score >= prefs.minScore);
    const urgent = events
      .filter((e) => e.deadlineState.kind === "urgent" && ((e.score ?? 0) >= prefs.minScore || e.status !== "discovered"))
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
    const top = relevant.filter((e) => e.deadlineState.kind !== "closed").slice(0, 5);
    const registered = pipeline.filter((e) => e.status === "registered" && e.startAt > now);
    const nextRegistered = registered[0];
    const openTasks = tasks.filter((t) => !t.done);
    const countBy = (s: PipelineStatus) => (s === "discovered" ? events.filter((e) => e.status === "discovered").length : pipeline.filter((e) => e.status === s).length);
    const neverRun = runs.rows.length === 0;
    const failing = runs.rows.filter((r) => r.status === "failed");
    const unscored = events.filter((e) => e.score == null).length;

    return (
      <>
        <PageHeader
          eyebrow={`Week of ${formatDate(new Date(`${weekStart(now)}T12:00:00Z`), { day: "numeric", month: "short", year: "numeric" })} · next 30 days`}
          title={`${greeting(now)}, Vikram`}
          sub={
            neverRun
              ? "No discovery has run yet. Run it now to pull live events."
              : `${urgent.length} registration deadline${urgent.length === 1 ? "" : "s"} within 7 days · ${openTasks.length} open action${openTasks.length === 1 ? "" : "s"} this week`
          }
          actions={
            <>
              <Link href="/events/new" className="inline-flex min-h-11 items-center rounded-md border border-[#d5d8d1] bg-surface px-4 text-sm font-medium text-ink no-underline hover:border-ink-2 hover:text-ink">
                Add event from link
              </Link>
              <JobButton job="discovery" label="Run discovery now" />
              <Link href="/digest" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-ink hover:text-white">
                Preview Monday digest
              </Link>
            </>
          }
        />

        {prefs.isDefault && (
          <Notice>
            <span>
              Using the default preferences (cities: {prefs.cities.join(", ")}). <Link href="/settings">Make them yours</Link> — changes apply immediately, no redeploy.
            </span>
          </Notice>
        )}
        {failing.length > 0 && (
          <Notice tone="urgent">
            <span>
              Latest run failed for {failing.map((f) => f.source_name).join(", ")}. Other sources are unaffected. <Link href="/status">Details</Link>
            </span>
          </Notice>
        )}
        {unscored > 0 && !neverRun && (
          <Notice>
            <span>{unscored} event{unscored === 1 ? " is" : "s are"} waiting for scoring. They will be ranked on the next run, or <Link href="/status">re-rank now</Link>.</span>
          </Notice>
        )}

        <section aria-label="This week at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Relevant events, next 30 days" value={relevant.length} note={`Fit ≥ ${prefs.minScore} · ${events.length} discovered`} />
          <Stat label="Deadlines under 7 days" value={urgent.length} tone={urgent.length ? "urgent" : undefined} note={urgent[0] ? `Earliest: ${formatDate(urgent[0].deadline!, { weekday: "short", day: "numeric", month: "short" })}` : "None this week"} />
          <Stat label="Open actions" value={openTasks.length} note={`of ${tasks.length} this week`} />
          <Stat label="Registered (upcoming)" value={registered.length} note={nextRegistered ? `Next: ${formatDate(nextRegistered.startAt, { weekday: "short", day: "numeric", month: "short" })}` : "Nothing registered yet"} />
          <Stat label="In your pipeline" value={pipeline.length} note="Saved, to register, registered…" />
        </section>

        <div className="flex flex-wrap items-start gap-6">
          <section aria-labelledby="top-h" className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5">
            <SectionTitle id="top-h" aside={<Link href="/events">All {events.length} events</Link>}>
              Top recommended
            </SectionTitle>
            {top.length ? (
              top.map((e) => <EventCard key={e.id} e={e} />)
            ) : (
              <EmptyState title={neverRun ? "No events yet" : "Nothing above your minimum fit score"}>
                {neverRun ? "Run discovery to pull live events from Luma, Eventbrite and Meetup." : <>Lower the minimum score in <Link href="/settings">Preferences</Link> or browse <Link href="/events">all events</Link>.</>}
              </EmptyState>
            )}
          </section>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
            <Card className="flex flex-col gap-3 p-5">
              <SectionTitle aside={urgent.length ? <span className="font-mono text-xs text-urgent">{urgent.length} URGENT</span> : null}>Deadlines under 7 days</SectionTitle>
              {urgent.length === 0 ? (
                <p className="text-sm text-muted">No stated registration deadlines close in the next 7 days. Many events don&apos;t publish one; those show &ldquo;Deadline unknown&rdquo;.</p>
              ) : (
                <ul className="flex flex-col">
                  {urgent.slice(0, 6).map((e) => (
                    <li key={e.id} className="flex items-center gap-3 border-t border-line-2 py-2.5">
                      <span className="w-14 shrink-0 rounded-md bg-urgent-soft py-1.5 text-center font-mono text-[13px] text-urgent">
                        {e.deadlineState.kind === "urgent" && e.deadlineState.daysLeft <= 1 ? "<1d" : `${e.deadlineState.kind === "urgent" ? e.deadlineState.daysLeft : ""}d`}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <Link href={`/events/${e.id}`} className="truncate text-sm font-medium text-ink no-underline hover:underline">
                          {e.title}
                        </Link>
                        <span className="text-xs text-muted">Closes {formatDate(e.deadline!, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} IST</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="flex flex-col gap-1 p-5">
              <SectionTitle aside={<span className="font-mono text-xs text-muted">{tasks.length - openTasks.length} / {tasks.length} DONE</span>}>This week&apos;s actions</SectionTitle>
              {tasks.length === 0 ? (
                <p className="pt-2 text-sm text-muted">No actions yet. Tasks appear when you save events or when strong matches are found.</p>
              ) : (
                <ul className="flex flex-col">
                  {tasks.slice(0, 7).map((t) => (
                    <TaskItem key={t.id} task={t} />
                  ))}
                </ul>
              )}
              <Link href="/checklist" className="pt-1 text-sm">
                Open checklist
              </Link>
            </Card>

            <Card className="flex flex-col gap-3 p-5">
              <SectionTitle>Coming up</SectionTitle>
              {registered.length === 0 ? (
                <p className="text-sm text-muted">No upcoming events marked Registered.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {registered.slice(0, 4).map((e) => (
                    <li key={e.id} className="text-sm">
                      <Link href={`/events/${e.id}`} className="font-medium text-ink no-underline hover:underline">
                        {e.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {formatEventWhen(e.startAt, e.allDay)} · {placeLabel(e)}
                        {e.startAt.getTime() - now.getTime() < 7 * DAY_MS && <Badge tone="accent">This week</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t border-line-2 pt-3 text-xs text-muted">Google Calendar: not connected (planned enhancement). Calendly: {prefs.calendlyUrl ? <a href={prefs.calendlyUrl}>link set</a> : <Link href="/settings">add your link</Link>}</p>
            </Card>
          </aside>
        </div>

        <section aria-labelledby="pl-h" className="flex flex-col gap-3.5">
          <SectionTitle id="pl-h" aside={<Link href="/pipeline">Open pipeline</Link>}>
            Event pipeline
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.keys(STATUS_LABELS) as PipelineStatus[]).map((s) => (
              <div key={s} className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">{STATUS_LABELS[s]}</span>
                <span className="font-mono text-2xl">{countBy(s)}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="src-h" className="flex flex-col gap-3.5">
          <SectionTitle id="src-h" aside={<Link href="/status">System status</Link>}>
            Source freshness
          </SectionTitle>
          <SourceTable rows={runs.rows} />
        </section>
      </>
    );
  });
}

function greeting(d: Date) {
  const h = Number(formatDate(d, { hour: "2-digit", hour12: false }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
