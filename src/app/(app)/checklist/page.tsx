import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddTask } from "@/components/checklist/add-task";
import { TaskItem } from "@/components/checklist/task-item";
import { renderOrError } from "@/components/shared/load";
import { Card, EmptyState, PageHeader, PageSkeleton } from "@/components/shared/ui";
import { syncWeeklyTasks } from "@/lib/services/checklist";
import { getPreferences, getUser } from "@/lib/services/user";
import { formatDate, weekStart } from "@/lib/time";

export const metadata: Metadata = { title: "Checklist" };

export default function ChecklistPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Checklist />
    </Suspense>
  );
}

const GROUPS = [
  { kind: "meeting", title: "Work meetings", color: "#2A4A8A" },
  { kind: "task", title: "Your tasks", color: "#7A4E0F" },
  { kind: "routine", title: "Weekly routine", color: "#5B3E96" },
  { kind: "register", title: "Register", color: "#C2410C" },
  { kind: "review", title: "Decide", color: "#2A4A8A" },
  { kind: "prepare", title: "Prepare", color: "#1F5F4A" },
  { kind: "follow_up", title: "Follow up", color: "#5B3E96" },
] as const;

async function Checklist() {
  await connection();
  return renderOrError(async () => {
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const tasks = await syncWeeklyTasks(user.id, prefs);
    const done = tasks.filter((t) => t.done).length;
    return (
      <>
        <PageHeader
          eyebrow={`Week of ${formatDate(new Date(`${weekStart(new Date())}T12:00:00Z`), { day: "numeric", month: "short" })}`}
          title="This week's actions"
          sub="Built only from real events, deadlines and your choices. Ticks are saved."
        />
        {tasks.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-line-2" role="progressbar" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done} aria-label="Actions done">
              <div className="h-full rounded-full bg-gradient-to-r from-[#1F5F4A] to-[#3F9A6E] transition-all" style={{ width: `${Math.round((done / tasks.length) * 100)}%` }} />
            </div>
            <span className="text-sm font-medium text-ink-2">
              {done} of {tasks.length} done
            </span>
          </div>
        )}
        <AddTask />
        {tasks.length === 0 ? (
          <EmptyState title="Nothing to do yet">Save events or run discovery, tasks appear for registrations, decisions, preparation and follow ups.</EmptyState>
        ) : (
          GROUPS.map((g) => {
            const list = tasks.filter((t) => (g.kind === "routine" ? t.kind.startsWith("routine") : t.kind === g.kind));
            if (list.length === 0) return null;
            return (
              <Card key={g.kind} className="px-5 py-4">
                <h2 className="flex items-center gap-2.5 text-base font-semibold">
                  <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                  {g.title}
                  <span className="text-sm font-normal text-faint">{list.filter((t) => !t.done).length} open</span>
                </h2>
                <ul className="mt-1">
                  {list.map((t) => (
                    <TaskItem key={t.id} task={t} />
                  ))}
                </ul>
              </Card>
            );
          })
        )}
      </>
    );
  });
}
