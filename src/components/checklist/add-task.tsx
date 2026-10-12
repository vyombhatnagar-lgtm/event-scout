"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldCls } from "@/components/shared/ui";

/** Add a task or a work meeting with a date and time (IST). */
export function AddTask() {
  const router = useRouter();
  const [kind, setKind] = useState<"task" | "meeting">("meeting");
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return (
    <form
      id="add"
      className="flex scroll-mt-6 flex-col gap-3 rounded-[22px] bg-surface p-5 shadow-[var(--shadow-soft)]"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setMsg(null);
        const dueAt = `${f.get("date")}T${f.get("time") || "10:00"}:00+05:30`;
        const res = await fetch("/api/checklist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, label: f.get("label"), detail: f.get("detail") || null, dueAt }) }).catch(() => null);
        const body = await res?.json().catch(() => ({}));
        setBusy(false);
        if (res?.ok) {
          (e.target as HTMLFormElement).reset();
          setMsg({ text: kind === "meeting" ? "Meeting added to your week." : "Task added. If it is still open next week, it carries forward.", bad: false });
          router.refresh();
        } else setMsg({ text: body?.error ?? "Could not add it, try again.", bad: true });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Add a task or meeting</h2>
        <div role="radiogroup" aria-label="Type" className="flex gap-1 rounded-full bg-[#F4F2ED] p-1">
          {(["meeting", "task"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-medium ${kind === k ? "bg-night text-white" : "text-ink-2"}`}>
              {k === "meeting" ? "Work meeting" : "Task"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex min-w-[220px] flex-[2] flex-col gap-1 text-[13px] font-medium text-muted">
          {kind === "meeting" ? "Meeting" : "Task"}
          <input name="label" required minLength={2} maxLength={160} placeholder={kind === "meeting" ? "Client call: operations review" : "Send proposal draft"} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-muted">
          Date
          <input name="date" type="date" required defaultValue={today} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-muted">
          Time
          <input name="time" type="time" defaultValue="10:00" className={fieldCls} />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[13px] font-medium text-muted">
          Note (optional)
          <input name="detail" maxLength={300} placeholder="Where, with whom" className={fieldCls} />
        </label>
        <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {msg && (
        <p role="status" className={`text-sm ${msg.bad ? "text-urgent" : "text-ok"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
