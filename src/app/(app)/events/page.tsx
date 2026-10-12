import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events/event-card";
import { renderOrError } from "@/components/shared/load";
import { EmptyState, PageHeader, PageSkeleton, fieldCls } from "@/components/shared/ui";
import { cityMatches } from "@/lib/discovery/cities";
import { listWindowEvents } from "@/lib/services/events";
import { getPreferences, getUser } from "@/lib/services/user";

export const metadata: Metadata = { title: "Explore" };

type SP = { q?: string; city?: string; fit?: string; deadline?: string; source?: string; format?: string };

export default function ExplorePage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      <PageHeader title="Explore" sub="Every live event in your cities over the next 30 days, best fit first." />
      <Suspense fallback={<PageSkeleton />}>
        <EventGrid searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </>
  );
}

function pillHref(sp: SP, patch: Partial<SP>) {
  const q = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v && v !== "all") as [string, string][]);
  const s = q.toString();
  return s ? `/events?${s}` : "/events";
}

function Pill({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm whitespace-nowrap no-underline transition ${on ? "bg-night font-medium text-white hover:text-white" : "bg-surface text-ink-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}

async function EventGrid({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return renderOrError(async () => {
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const all = (await listWindowEvents(user.id)).filter((e) => e.status !== "dismissed");
    const q = sp.q?.trim().toLowerCase() ?? "";
    const fit = sp.fit ?? "relevant";
    const sources = [...new Set(all.flatMap((e) => e.sources.map((s) => s.name)))].sort();

    const shown = all.filter((e) => {
      if (q && !`${e.title} ${e.organiser ?? ""} ${e.summary ?? ""}`.toLowerCase().includes(q)) return false;
      if (sp.city && sp.city !== "all" && !cityMatches(e.city, [sp.city])) return false;
      if (fit === "relevant" && (e.score == null || e.score < prefs.minScore)) return false;
      if (sp.deadline === "urgent" && e.deadlineState.kind !== "urgent") return false;
      if (sp.deadline === "known" && !e.deadline) return false;
      if (sp.source && sp.source !== "all" && !e.sources.some((s) => s.name === sp.source)) return false;
      if (sp.format && sp.format !== "all" && e.format !== sp.format) return false;
      return true;
    });

    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Pill href={pillHref(sp, { city: "all" })} on={!sp.city || sp.city === "all"}>
              All cities
            </Pill>
            {prefs.cities.map((c) => (
              <Pill key={c} href={pillHref(sp, { city: c })} on={sp.city === c}>
                {c}
              </Pill>
            ))}
            <span className="mx-1 w-px shrink-0 bg-line" aria-hidden="true" />
            <Pill href={pillHref(sp, { deadline: sp.deadline === "urgent" ? undefined : "urgent" })} on={sp.deadline === "urgent"}>
              Closing within 7 days
            </Pill>
            <Pill href={pillHref(sp, { fit: fit === "all" ? undefined : "all" })} on={fit === "all"}>
              Include lower fit
            </Pill>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2.5" aria-label="Search and filter">
            {sp.city && <input type="hidden" name="city" value={sp.city} />}
            {sp.deadline && <input type="hidden" name="deadline" value={sp.deadline} />}
            {sp.fit && <input type="hidden" name="fit" value={sp.fit} />}
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] font-medium text-muted">
              Search
              <input name="q" defaultValue={sp.q ?? ""} placeholder="Title, organiser, topic" className={fieldCls} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-muted">
              Format
              <select name="format" defaultValue={sp.format ?? "all"} className={fieldCls}>
                <option value="all">Any format</option>
                <option value="in_person">In person</option>
                <option value="hybrid">Hybrid</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-muted">
              Source
              <select name="source" defaultValue={sp.source ?? "all"} className={fieldCls}>
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-night px-5 text-sm font-medium text-white hover:opacity-90">
              Apply
            </button>
          </form>
        </div>
        <p className="text-sm text-muted" role="status">
          {shown.length} of {all.length} events
        </p>
        {shown.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
            {shown.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <EmptyState title={all.length ? "Nothing matches those filters." : "No events yet."}>
            {all.length ? (
              <Link href="/events">Clear filters</Link>
            ) : (
              "New events arrive every morning at 05:00, or add one from a link."
            )}
          </EmptyState>
        )}
      </div>
    );
  });
}
