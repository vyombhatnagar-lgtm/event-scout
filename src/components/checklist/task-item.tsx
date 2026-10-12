"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface TaskVM {
  id: string;
  label: string;
  detail: string | null;
  done: boolean;
  eventId: string | null;
  kind?: string;
  dueAt?: Date | string | null;
}

const TAGS: Record<string, { text: string; bg: string; fg: string }> = {
  carried: { text: "Carried over", bg: "var(--urgent-soft)", fg: "var(--urgent)" },
  meeting: { text: "Meeting", bg: "#E3E9F5", fg: "#2A4A8A" },
  routine: { text: "Weekly", bg: "#ECE6F6", fg: "#5B3E96" },
  task: { text: "Your task", bg: "#F6EBDA", fg: "#7A4E0F" },
  new: { text: "New", bg: "var(--ok-soft)", fg: "var(--ok)" },
};

function due(d: Date | string | null | undefined, meeting: boolean) {
  if (!d) return null;
  const date = new Date(d);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" };
  if (meeting || date.getUTCHours() !== 4 || date.getUTCMinutes() !== 30) Object.assign(opts, { hour: "2-digit", minute: "2-digit", hour12: false });
  return new Intl.DateTimeFormat("en-IN", opts).format(date);
}

/** One action: round tick (saved to the server), a tag showing where it came from, and when it is due. */
export function TaskItem({ task, carried = false }: { task: TaskVM; carried?: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(task.done);
  const [error, setError] = useState(false);
  const kind = task.kind ?? "";
  const tag = TAGS[carried ? "carried" : kind === "meeting" ? "meeting" : kind.startsWith("routine") ? "routine" : kind === "task" ? "task" : "new"];
  const when = due(task.dueAt, kind === "meeting");
  const own = kind === "task" || kind === "meeting";
  return (
    <li className="flex items-start gap-3 border-t border-line-2 py-3 first:border-t-0">
      <input
        id={`task-${task.id}`}
        type="checkbox"
        checked={done}
        onChange={async (e) => {
          const next = e.target.checked;
          setDone(next);
          setError(false);
          const res = await fetch(`/api/checklist/${task.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done: next }) }).catch(() => null);
          if (!res?.ok) {
            setDone(!next);
            setError(true);
          }
        }}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-[#C9C5BA] bg-surface transition checked:border-brand checked:bg-brand checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223.5%22><path d=%22M6 12l4 4 8-8%22/></svg>')] bg-center bg-no-repeat"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={`task-${task.id}`} className={`cursor-pointer text-sm leading-snug ${done ? "text-faint line-through" : "text-ink"}`}>
          {task.label}
        </label>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: tag.bg, color: tag.fg }}>
            {tag.text}
          </span>
          {when && <span>{when}</span>}
          {task.detail && task.detail !== "Weekly routine" && <span>{task.detail}</span>}
          {task.eventId && <Link href={`/events/${task.eventId}`}>View event</Link>}
          {own && (
            <button
              type="button"
              className="text-faint underline hover:text-urgent"
              onClick={async () => {
                if (!confirm(`Delete "${task.label}"?`)) return;
                const res = await fetch(`/api/checklist/${task.id}`, { method: "DELETE" }).catch(() => null);
                if (res?.ok) router.refresh();
                else setError(true);
              }}
            >
              Delete
            </button>
          )}
        </span>
        {error && (
          <span role="alert" className="text-xs text-urgent">
            Could not save, try again.
          </span>
        )}
      </div>
    </li>
  );
}
