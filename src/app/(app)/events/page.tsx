import type { Metadata } from "next";
import { Suspense } from "react";
import { EventCard } from "@/components/events/event-card";
import { renderOrError } from "@/components/shared/load";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/shared/ui";
import { cityMatches } from "@/lib/discovery/cities";
import { listWindowEvents } from "@/lib/services/events";
import { getPreferences, getUser } from "@/lib/services/user";

export const metadata: Metadata = { title: "Events" };

type SP = { q?: string; city?: string; fit?: string; deadline?: string; source?: string; format?: string };

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <>
      <PageHeader eyebrow="Next 30 days" title="Events" sub="Every live event discovered for your cities, ranked by fit." />
      <Suspense fallback={<PageSkeleton />}>
        <EventList searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </>
  );
}

const field = "min-h-11 rounded-md border border-[#c9cdc5] bg-surface px-3 text-sm";

async function EventList({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return renderOrError(async () => {
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const all = await listWindowEvents(user.id);
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
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4" aria-label="Filter events">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] font-medium">
            Search
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Title, organiser, topic" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            City
            <select name="city" defaultValue={sp.city ?? "all"} className={field}>
              <option value="all">All my cities</option>
              {prefs.cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Fit
            <select name="fit" defaultValue={fit} className={field}>
              <option value="relevant">Fit ≥ {prefs.minScore}</option>
              <option value="all">All scores</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Deadline
            <select name="deadline" defaultValue={sp.deadline ?? "any"} className={field}>
              <option value="any">Any</option>
              <option value="urgent">Under 7 days</option>
              <option value="known">Deadline known</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Format
            <select name="format" defaultValue={sp.format ?? "all"} className={field}>
              <option value="all">Any</option>
              <option value="in_person">In person</option>
              <option value="hybrid">Hybrid</option>
              <option value="online">Online</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium">
            Source
            <select name="source" defaultValue={sp.source ?? "all"} className={field}>
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-ink">
            Apply
          </button>
        </form>
        <p className="text-sm text-muted" role="status">
          Showing {shown.length} of {all.length} events in the next 30 days.
        </p>
        {shown.length ? (
          <div className="flex flex-col gap-3.5">
            {shown.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <EmptyState title={all.length ? "No events match these filters" : "No events discovered yet"}>
            {all.length ? "Try “All scores” or clear the search." : "Run discovery from the dashboard to pull live events."}
          </EmptyState>
        )}
      </div>
    );
  });
}
