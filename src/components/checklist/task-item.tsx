"use client";

import Link from "next/link";
import { useState } from "react";

export interface TaskVM {
  id: string;
  label: string;
  detail: string | null;
  done: boolean;
  eventId: string | null;
}

/** Round checkbox that persists to the server; reverts and explains if the save fails. */
export function TaskItem({ task }: { task: TaskVM }) {
  const [done, setDone] = useState(task.done);
  const [error, setError] = useState(false);
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
          const res = await fetch(`/api/checklist/${task.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ done: next }),
          }).catch(() => null);
          if (!res?.ok) {
            setDone(!next);
            setError(true);
          }
        }}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer appearance-none rounded-full border-2 border-[#C9C5BA] bg-surface transition checked:border-brand checked:bg-brand checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223.5%22><path d=%22M6 12l4 4 8-8%22/></svg>')] bg-center bg-no-repeat"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={`task-${task.id}`} className={`cursor-pointer text-sm leading-snug ${done ? "text-faint line-through" : "text-ink"}`}>
          {task.label}
        </label>
        <span className="text-xs text-faint">
          {task.detail}
          {task.eventId && (
            <>
              {task.detail ? " · " : ""}
              <Link href={`/events/${task.eventId}`}>View</Link>
            </>
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
