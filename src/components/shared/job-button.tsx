"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonCls } from "./ui";

type Job = "discovery" | "scoring" | "digest";

function describe(job: Job, status: string, detail: Record<string, unknown>): string {
  if (job === "digest") {
    const o = detail.outcome as { outcome: string; reason?: string; recipient?: string; error?: string } | undefined;
    if (o?.outcome === "sent") return `Digest sent to ${o.recipient}.`;
    if (o?.outcome === "skipped") return `Not sent: ${o.reason}`;
    if (o?.outcome === "failed") return `Send failed: ${o.error}`;
  }
  if (job === "discovery") {
    const d = detail.discovery as { merged: number; inserted: number; sources: { source: string; status: string; accepted: number }[] } | undefined;
    const ai = detail.ai as { classified: number; scored: number; errors: string[]; stoppedEarly: boolean } | undefined;
    if (d) {
      const src = d.sources.map((s) => `${s.source} ${s.status === "failed" ? "failed" : s.accepted}`).join(", ");
      return `${d.merged} events (${d.inserted} new) · ${src} · AI classified ${ai?.classified ?? 0}, scored ${ai?.scored ?? 0}${ai?.errors.length ? ` · ${ai.errors.length} AI error(s)` : ""}${ai?.stoppedEarly ? " · more AI work queued for next run" : ""}`;
    }
  }
  if (job === "scoring") {
    const ai = detail.ai as { scored: number; scoredRulesOnly: number; errors: string[] } | undefined;
    if (ai) return `Reranked: ${ai.scored} with Gemini, ${ai.scoredRulesOnly} with rules only${ai.errors.length ? ` · ${ai.errors[0]}` : ""}`;
  }
  return `Finished: ${status}`;
}

/** Runs a server job and reports the real outcome, never a fake success. */
export function JobButton({ job, label, variant = "secondary" }: { job: Job; label: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={busy}
        className={buttonCls[variant]}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const res = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job }) });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) setMsg({ text: body.detail ?? body.error ?? `Failed (${res.status})`, bad: true });
            else setMsg({ text: describe(job, body.status, body.detail ?? {}), bad: body.status === "failed" });
            router.refresh();
          } catch {
            setMsg({ text: "Network error, the job may still be running. Check System status.", bad: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working… (can take a few minutes)" : label}
      </button>
      {msg && (
        <p role="status" className={`max-w-md text-xs ${msg.bad ? "text-urgent" : "text-muted"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
