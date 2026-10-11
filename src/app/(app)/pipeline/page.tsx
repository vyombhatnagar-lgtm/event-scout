import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeadlineText, placeLabel } from "@/components/events/event-card";
import { STATUS_LABELS, StatusControl } from "@/components/events/status-control";
import { renderOrError } from "@/components/shared/load";
import { Card, EmptyState, PageHeader, PageSkeleton } from "@/components/shared/ui";
import type { PipelineStatus } from "@/lib/db/schema";
import { listPipelineEvents } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";
import { formatEventWhen } from "@/lib/time";

export const metadata: Metadata = { title: "Pipeline" };

const ORDER: PipelineStatus[] = ["saved", "to_register", "registered", "attended", "follow_up_complete"];

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Event pipeline"
        sub="Saved → To register → Registered → Attended → Follow-up complete. You set every status; stages can be skipped."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Pipeline />
      </Suspense>
    </>
  );
}

async function Pipeline() {
  await connection();
  return renderOrError(async () => {
    const user = await getUser();
    const events = await listPipelineEvents(user.id);
    if (events.length === 0) {
      return (
        <EmptyState title="Your pipeline is empty">
          Save an event from the <Link href="/dashboard">dashboard</Link> or <Link href="/events">events list</Link> to start tracking it.
        </EmptyState>
      );
    }
    return (
      <div className="flex flex-col gap-6">
        {ORDER.map((status) => {
          const list = events.filter((e) => e.status === status);
          return (
            <section key={status} aria-labelledby={`h-${status}`} className="flex flex-col gap-2.5">
              <h2 id={`h-${status}`} className="text-[15px] font-semibold">
                {STATUS_LABELS[status]} <span className="font-mono text-sm text-muted">({list.length})</span>
              </h2>
              {list.length === 0 ? (
                <p className="text-sm text-muted">None.</p>
              ) : (
                <Card className="divide-y divide-line-2">
                  {list.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link href={`/events/${e.id}`} className="font-medium text-ink no-underline hover:underline">
                          {e.title}
                        </Link>
                        <span className="text-xs text-muted">
                          {formatEventWhen(e.startAt, e.allDay)} · {placeLabel(e)} · <DeadlineText e={e} />
                        </span>
                      </div>
                      <StatusControl eventId={e.id} status={e.status} compact />
                    </div>
                  ))}
                </Card>
              )}
            </section>
          );
        })}
      </div>
    );
  });
}
