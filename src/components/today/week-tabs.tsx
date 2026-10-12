"use client";

import Link from "next/link";
import { useState } from "react";
import { TaskItem, type TaskVM } from "@/components/checklist/task-item";
import type { Pointer } from "@/lib/checklist/recap-pointers";
import { RecapList } from "./recap-list";

export interface CarriedEventVM {
  id: string;
  title: string;
  when: string;
  reason: string;
  deadline: string | null;
  urgent: boolean;
  color: string;
}

/** "This week" checklist and a "From last week" tab for anything still pending. */
export function WeekTabs({ thisWeek, lastWeek, carried, pointers, range }: { thisWeek: TaskVM[]; lastWeek: TaskVM[]; carried: CarriedEventVM[]; pointers: Pointer[]; range: string }) {
  const pending = lastWeek.length + carried.length;
  const [tab, setTab] = useState<"now" | "last">("now");
  const done = thisWeek.filter((t) => t.done).length;

  const tabCls = (on: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition ${on ? "bg-night text-white" : "text-ink-2 hover:bg-line-2"}`;

  return (
    <section aria-label="Actions" className="rounded-[22px] bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Which week" className="flex gap-1 rounded-full bg-[#F4F2ED] p-1">
          <button role="tab" type="button" aria-selected={tab === "now"} onClick={() => setTab("now")} className={tabCls(tab === "now")}>
            This week
          </button>
          <button role="tab" type="button" aria-selected={tab === "last"} onClick={() => setTab("last")} className={tabCls(tab === "last")}>
            From last week
            {pending > 0 && <span className={`rounded-full px-1.5 text-[11px] font-semibold ${tab === "last" ? "bg-white/20 text-white" : "bg-urgent-soft text-urgent"}`}>{pending}</span>}
          </button>
        </div>
        {tab === "now" && (
          <span className="text-[12.5px] text-faint">
            {done}/{thisWeek.length} done
          </span>
        )}
      </div>

      {tab === "now" ? (
        <div role="tabpanel">
          {thisWeek.length === 0 ? (
            <p className="py-2 text-sm text-muted">Actions appear as you save and register for events.</p>
          ) : (
            <ul className="flex flex-col">
              {thisWeek.slice(0, 5).map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </ul>
          )}
          <div className="flex gap-4 text-sm">
            <Link href="/checklist">See all actions</Link>
            <Link href="/checklist#add">Add a task or meeting</Link>
          </div>
        </div>
      ) : (
        <div role="tabpanel">
          <p className="pt-1 pb-1.5 text-xs font-semibold tracking-[0.06em] text-faint uppercase">Last week · {range}</p>
          <RecapList pointers={pointers} />
          {pending > 0 && (
            <>
              {lastWeek.length > 0 && (
                <>
                  <p className="pt-1 text-xs font-semibold tracking-[0.06em] text-faint uppercase">Unfinished actions</p>
                  <ul className="flex flex-col">
                    {lastWeek.map((t) => (
                      <TaskItem key={t.id} task={t} carried />
                    ))}
                  </ul>
                </>
              )}
              {carried.length > 0 && (
                <>
                  <p className="pt-3 pb-1 text-xs font-semibold tracking-[0.06em] text-faint uppercase">Still undecided</p>
                  <ul className="flex flex-col gap-2">
                    {carried.map((e) => (
                      <li key={e.id} className="flex gap-3 rounded-2xl bg-[#F7F5F0] p-3">
                        <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden="true" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <Link href={`/events/${e.id}`} className="text-sm font-medium text-ink no-underline hover:underline">
                            {e.title}
                          </Link>
                          <span className="text-xs text-muted">
                            {e.when} · {e.reason}
                          </span>
                          {e.deadline && <span className={`text-xs ${e.urgent ? "font-medium text-urgent" : "text-faint"}`}>{e.deadline}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <Link href="/pipeline#last-week" className="mt-2 inline-block text-sm">
            Open last week in My events
          </Link>
        </div>
      )}
    </section>
  );
}
