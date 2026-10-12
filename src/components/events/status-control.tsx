"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PipelineStatus } from "@/lib/db/schema";

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  discovered: "Discovered",
  saved: "Saved",
  to_register: "To register",
  registered: "Registered",
  attended: "Attended",
  follow_up_complete: "Follow up complete",
  dismissed: "Not for me",
};

async function put(eventId: string, status: PipelineStatus) {
  const res = await fetch(`/api/events/${eventId}/status`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not update status");
}

/** Pipeline status: a quick Save button plus a full status selector. Status is only ever changed by the user. */
export function StatusControl({ eventId, status, compact = false }: { eventId: string; status: PipelineStatus; compact?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (next: PipelineStatus) => {
    const prev = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      try {
        await put(eventId, next);
        router.refresh();
      } catch (e) {
        setCurrent(prev);
        setError(e instanceof Error ? e.message : "Could not update status");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {current === "discovered" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => update("saved")}
          className="inline-flex min-h-10 items-center rounded-xl border border-line bg-surface px-3 text-[13px] font-medium transition hover:border-faint disabled:opacity-60"
        >
          Save
        </button>
      )}
      <label className="flex items-center gap-1.5 text-[13px] text-muted">
        <span className={compact ? "sr-only" : ""}>Status</span>
        <select
          value={current}
          disabled={pending}
          onChange={(e) => update(e.target.value as PipelineStatus)}
          className="min-h-10 rounded-xl border border-line bg-surface px-2.5 text-[13px] text-ink disabled:opacity-60"
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {pending && <span className="text-xs text-muted">Saving…</span>}
      {error && (
        <span role="alert" className="text-xs text-urgent">
          {error}
        </span>
      )}
    </div>
  );
}
