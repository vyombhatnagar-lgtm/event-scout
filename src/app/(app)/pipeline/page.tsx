import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeadlineText, placeLabel } from "@/components/events/event-card";
import { StatusControl } from "@/components/events/status-control";
import { renderOrError } from "@/components/shared/load";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/shared/ui";
import type { PipelineStatus } from "@/lib/db/schema";
import { type EventView, listPipelineEvents } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";
import { formatDate, formatEventWhen } from "@/lib/time";
import { hueFor } from "@/lib/ui/colors";

export const metadata: Metadata = { title: "My events" };

const LANES: { key: string; title: string; hint: string; statuses: PipelineStatus[]; accent: string; tint: string }[] = [
  { key: "going", title: "Going", hint: "Registered and upcoming", statuses: ["registered"], accent: "#1F5F4A", tint: "#E4EEE6" },
  { key: "register", title: "To register", hint: "You started — finish before the deadline", statuses: ["to_register"], accent: "#C2410C", tint: "#FDF1EA" },
  { key: "saved", title: "Saved", hint: "Worth a second look", statuses: ["saved"], accent: "#2A4A8A", tint: "#E3E9F5" },
  { key: "after", title: "After the event", hint: "Attended — follow up while it's fresh", statuses: ["attended", "follow_up_complete"], accent: "#5B3E96", tint: "#ECE6F6" },
];

export default function MyEventsPage() {
  return (
    <>
      <PageHeader
        title="My events"
        sub="Everything you've saved, are registering for, or are going to. You move events along — nothing changes on its own."
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

async function Lanes() {
  await connection();
  return renderOrError(async () => {
    const now = new Date();
    const user = await getUser();
    const events = await listPipelineEvents(user.id, now);
    const visible = events.filter((e) => e.status !== "dismissed");
    const dismissed = events.filter((e) => e.status === "dismissed");
    if (visible.length === 0) {
      return (
        <EmptyState title="Nothing saved yet.">
          Open <Link href="/dashboard">Today</Link> and decide on a few cards — anything you save or register for shows up here.
        </EmptyState>
      );
    }
    return (
      <div className="flex flex-col gap-8">
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
            <summary className="cursor-pointer text-sm text-muted">Not for me ({dismissed.length}) — hidden from Today and the briefing</summary>
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
