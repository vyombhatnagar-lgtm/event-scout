import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
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
  { kind: "register", title: "Register" },
  { kind: "review", title: "Decide" },
  { kind: "prepare", title: "Prepare" },
  { kind: "follow_up", title: "Follow up" },
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
          title="Weekly action checklist"
          sub={`${done} of ${tasks.length} done. Tasks come only from real events, deadlines and your pipeline. Progress is saved.`}
        />
        {tasks.length === 0 ? (
          <EmptyState title="Nothing to do yet">Save events or run discovery — tasks appear for registrations, decisions, preparation and follow-ups.</EmptyState>
        ) : (
          GROUPS.map((g) => {
            const list = tasks.filter((t) => t.kind === g.kind);
            if (list.length === 0) return null;
            return (
              <Card key={g.kind} className="px-5 py-3">
                <h2 className="pt-1 text-[15px] font-semibold">{g.title}</h2>
                <ul className="divide-y divide-line-2">
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
