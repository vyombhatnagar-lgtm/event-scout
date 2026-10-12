"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface SourceVM {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  lastCheckedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  eventsFound: number;
}

const input = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm";

/** Manage extra sources: conference sites, iSPIRT pages, newsletter feeds, iCal feeds. */
export function SourcesManager({ initial }: { initial: SourceVM[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (path: string, init: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { "content-type": "application/json" } }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) throw new Error(body?.error ?? "Request failed");
    router.refresh();
  };

  return (
    <section aria-labelledby="src-h" className="flex flex-col gap-4 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-6">
      <div>
        <h2 id="src-h" className="text-[17px] font-semibold">
          Sources
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          Built in: Luma, Eventbrite, Meetup and Gemini web search. Add conference sites, iSPIRT pages, newsletter RSS feeds or iCal feeds below, they are checked daily.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-line-2 rounded-xl border border-line">
        {initial.length === 0 && <li className="px-4 py-3 text-sm text-muted">No extra sources yet.</li>}
        {initial.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className={`size-2 rounded-full ${!s.enabled ? "bg-line" : s.lastStatus === "error" ? "bg-urgent" : s.lastCheckedAt ? "bg-ok" : "bg-[#c9cdc5]"}`} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{s.label}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs">
                {s.url}
              </a>
              <span className="text-xs text-muted">
                {s.lastCheckedAt ? `Last checked ${new Date(s.lastCheckedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} · ${s.eventsFound} upcoming event${s.eventsFound === 1 ? "" : "s"}` : "Not checked yet, runs with the next discovery"}
                {s.lastError ? ` · ${s.lastError}` : ""}
              </span>
            </span>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => call(`/api/sources/${s.id}`, { method: "PATCH", body: JSON.stringify({ enabled: e.target.checked }) }).catch((err) => setMsg({ text: err.message, bad: true }))}
                className="size-4 accent-[var(--brand)]"
              />
              Active
            </label>
            <button
              type="button"
              className="min-h-9 rounded-xl border border-line px-3 text-xs hover:border-urgent hover:text-urgent"
              onClick={() => confirm(`Remove "${s.label}"? Events already found stay.`) && call(`/api/sources/${s.id}`, { method: "DELETE" }).catch((err) => setMsg({ text: err.message, bad: true }))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          try {
            await call("/api/sources", { method: "POST", body: JSON.stringify({ label, url }) });
            setLabel("");
            setUrl("");
            setMsg({ text: "Added. It will be checked on the next discovery run.", bad: false });
          } catch (err) {
            setMsg({ text: (err as Error).message, bad: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-[13px] font-medium">
          Name
          <input value={label} onChange={(e) => setLabel(e.target.value)} required minLength={2} placeholder="e.g. CII events" className={input} />
        </label>
        <label className="flex min-w-[240px] flex-[2] flex-col gap-1.5 text-[13px] font-medium">
          Link (page, RSS or iCal)
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" className={input} />
        </label>
        <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60">
          {busy ? "Adding…" : "Add source"}
        </button>
      </form>
      {msg && (
        <p role="status" className={`text-sm ${msg.bad ? "text-urgent" : "text-ok"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
