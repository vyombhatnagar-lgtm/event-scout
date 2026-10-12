import Link from "next/link";
import type { EventView } from "@/lib/services/events";
import { DAY_MS, formatDate, localDate } from "@/lib/time";
import { hueFor } from "@/lib/ui/colors";

const MAX_IDEAS = 3;

function time(e: EventView) {
  return e.allDay ? "All day" : formatDate(e.startAt, { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * The whole next 7 days in one view: what Vikram is going to, what's on his list,
 * the best undecided matches, and which registrations close on each day.
 */
export function WeekGlance({ now, events, minScore }: { now: Date; events: EventView[]; minScore: number }) {
  const days = Array.from({ length: 7 }, (_, k) => localDate(new Date(now.getTime() + k * DAY_MS)));
  const today = days[0];
  const live = events.filter((e) => e.status !== "dismissed");

  const columns = days.map((key) => {
    const onDay = live.filter((e) => localDate(e.startAt) === key).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    const going = onDay.filter((e) => e.status === "registered" || e.status === "attended");
    const listed = onDay.filter((e) => e.status === "saved" || e.status === "to_register");
    const ideas = onDay
      .filter((e) => e.status === "discovered" && e.score != null && e.score >= minScore && e.deadlineState.kind !== "closed")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const closing = live
      .filter((e) => e.deadline && localDate(e.deadline) === key && e.deadlineState.kind !== "closed" && ((e.score ?? 0) >= minScore || e.status !== "discovered"))
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 6));
    return { key, date, going, listed, ideas, closing };
  });

  const totals = {
    going: columns.reduce((n, c) => n + c.going.length, 0),
    listed: columns.reduce((n, c) => n + c.listed.length, 0),
    ideas: columns.reduce((n, c) => n + c.ideas.length, 0),
    closing: columns.reduce((n, c) => n + c.closing.length, 0),
  };

  return (
    <section id="week" aria-labelledby="week-glance-h" className="scroll-mt-6 rounded-[26px] bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="week-glance-h" className="font-serif text-[32px] leading-none">
            Your week at a glance
          </h2>
          <p className="mt-2 text-sm text-muted">
            {formatDate(now, { day: "numeric", month: "short" })} – {formatDate(new Date(now.getTime() + 6 * DAY_MS), { day: "numeric", month: "short" })} · {totals.going} going · {totals.listed} on your list · {totals.ideas} worth a look ·{" "}
            <span className={totals.closing ? "font-medium text-urgent" : ""}>{totals.closing} closing</span>
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-night" aria-hidden="true" />
            Going
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full border-2 border-brand" aria-hidden="true" />
            On your list
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#E7C9A0]" aria-hidden="true" />
            Worth a look
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded bg-urgent" aria-hidden="true" />
            Registration closes
          </li>
        </ul>
      </div>

      <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="grid min-w-[880px] grid-cols-7 gap-2.5">
          {columns.map((c) => {
            const isToday = c.key === today;
            const weekend = [0, 6].includes(c.date.getUTCDay());
            const empty = !c.going.length && !c.listed.length && !c.ideas.length && !c.closing.length;
            return (
              <li key={c.key} className={`flex min-h-[220px] flex-col gap-2 rounded-[18px] p-2.5 ${isToday ? "bg-brand-soft" : weekend ? "bg-[#F1EEE7]" : "bg-[#F7F5F0]"}`}>
                <div className="flex items-baseline justify-between px-1">
                  <span className={`text-xs font-semibold tracking-[0.06em] uppercase ${isToday ? "text-brand" : "text-muted"}`}>{isToday ? "Today" : formatDate(c.date, { weekday: "short" })}</span>
                  <span className={`text-lg leading-none font-semibold ${isToday ? "text-brand" : ""}`}>{formatDate(c.date, { day: "numeric" })}</span>
                </div>

                {c.closing.map((e) => (
                  <Link key={`dl-${e.id}`} href={`/events/${e.id}`} className="block border-l-2 border-urgent px-2 py-0.5 text-[11.5px] leading-snug text-urgent no-underline hover:underline" title={e.title}>
                    <span className="font-semibold">Closes {formatDate(e.deadline!, { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                    <span className="line-clamp-1 text-[#9A4A20]">{e.title}</span>
                  </Link>
                ))}

                {c.going.map((e) => (
                  <Link key={e.id} href={`/events/${e.id}`} className="flex flex-col gap-0.5 rounded-xl bg-night px-2.5 py-2 text-white no-underline hover:text-white hover:opacity-90" title={e.title}>
                    <span className="text-[11px] text-[#CFE6DA]">Going · {time(e)}</span>
                    <span className="line-clamp-2 text-[12.5px] leading-snug font-medium">{e.title}</span>
                  </Link>
                ))}

                {c.listed.map((e) => {
                  const h = hueFor(e.categories, e.title);
                  return (
                    <Link key={e.id} href={`/events/${e.id}`} className="flex flex-col gap-0.5 rounded-xl border-2 bg-surface px-2.5 py-1.5 text-ink no-underline hover:text-ink" style={{ borderColor: h.ink }} title={e.title}>
                      <span className="text-[11px]" style={{ color: h.ink }}>
                        {e.status === "to_register" ? "To register" : "Saved"} · {time(e)}
                      </span>
                      <span className="line-clamp-2 text-[12.5px] leading-snug font-medium">{e.title}</span>
                    </Link>
                  );
                })}

                {c.ideas.slice(0, MAX_IDEAS).map((e) => {
                  const h = hueFor(e.categories, e.title);
                  return (
                    <Link key={e.id} href={`/events/${e.id}`} className="flex flex-col gap-0.5 rounded-xl px-2.5 py-1.5 no-underline transition hover:-translate-y-px" style={{ background: h.tint, color: h.ink }} title={e.title}>
                      <span className="text-[11px] opacity-80">
                        {time(e)} · fit {e.score}
                      </span>
                      <span className="line-clamp-2 text-[12.5px] leading-snug font-medium text-ink">{e.title}</span>
                    </Link>
                  );
                })}
                {c.ideas.length > MAX_IDEAS && (
                  <Link href="/events" className="px-1 text-[11.5px] text-muted no-underline hover:text-ink">
                    +{c.ideas.length - MAX_IDEAS} more
                  </Link>
                )}

                {empty && <span className="m-auto text-xs text-faint">Free</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
