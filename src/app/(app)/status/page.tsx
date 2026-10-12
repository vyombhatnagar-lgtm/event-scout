import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { JobButton } from "@/components/shared/job-button";
import { renderOrError } from "@/components/shared/load";
import { Badge, Card, PageHeader, PageSkeleton, SectionTitle } from "@/components/shared/ui";
import { SourceTable } from "@/components/status/source-table";
import { CONNECTORS } from "@/lib/discovery/pipeline";
import { geminiModel } from "@/lib/ai/gemini";
import { latestJobRuns, latestSourceRuns } from "@/lib/services/events";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "System status" };

export default function StatusPage() {
  return (
    <>
      <PageHeader
        title="System status"
        sub="Live source health, scheduled job history and configuration. Failures are shown here, never hidden or replaced with sample data."
        actions={
          <>
            <JobButton job="discovery" label="Run discovery now" />
            <JobButton job="scoring" label="Rerank events" />
          </>
        }
      />
      <Suspense fallback={<PageSkeleton />}>
        <Status />
      </Suspense>
    </>
  );
}

const CONFIG = [
  ["DATABASE_URL", "Neon Postgres"],
  ["GEMINI_API_KEY", "Gemini Flash (AI)"],
  ["RESEND_API_KEY", "Email delivery"],
  ["CRON_SECRET", "Scheduled jobs"],
  ["APP_PASSWORD", "Access protection"],
] as const;

async function Status() {
  await connection();
  let model = "invalid";
  try {
    model = geminiModel();
  } catch {}
  return renderOrError(async () => {
    const [sources, jobs] = await Promise.all([latestSourceRuns(), latestJobRuns(15)]);
    return (
      <>
        <section className="flex flex-col gap-3">
          <SectionTitle>Configuration</SectionTitle>
          <Card className="grid gap-x-6 gap-y-2 p-5 sm:grid-cols-2">
            {CONFIG.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {label} <code className="font-mono text-xs text-muted">{k}</code>
                </span>
                <Badge tone={process.env[k] ? "ok" : "urgent"}>{process.env[k] ? "Set" : "Missing"}</Badge>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>AI model</span>
              <code className="font-mono text-xs">{model}</code>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Sources</SectionTitle>
          <SourceTable rows={sources.rows} />
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            {CONNECTORS.map((c) => (
              <li key={c.name}>
                <strong className="text-ink-2">{c.name}:</strong> {c.method}
              </li>
            ))}
          </ul>
          {sources.rows
            .filter((r) => r.errors.length)
            .map((r) => (
              <details key={r.source_name} className="rounded-[22px] bg-surface shadow-[var(--shadow-soft)] px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  {r.source_name}: {r.errors.length} issue(s) in latest run
                </summary>
                <ul className="mt-2 list-disc pl-5 font-mono text-xs text-ink-2">
                  {r.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            ))}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Job history</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wider text-muted uppercase">
                  <th scope="col" className="px-4 py-3">Started (IST)</th>
                  <th scope="col" className="px-4 py-3">Job</th>
                  <th scope="col" className="px-4 py-3">Trigger</th>
                  <th scope="col" className="px-4 py-3">Duration</th>
                  <th scope="col" className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-muted">No jobs have run yet.</td>
                  </tr>
                )}
                {jobs.map((j) => {
                  const ai = (j.detail as { ai?: { errors?: string[] }; error?: string }).ai;
                  const err = (j.detail as { error?: string }).error ?? ai?.errors?.[0];
                  return (
                    <tr key={j.id} className="border-t border-line-2 align-top">
                      <td className="px-4 py-3 font-mono text-[13px]">{formatDate(j.startedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                      <td className="px-4 py-3">{j.job}</td>
                      <td className="px-4 py-3">{j.trigger}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{j.finishedAt ? `${Math.round((j.finishedAt.getTime() - j.startedAt.getTime()) / 1000)}s` : "running"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={j.status === "success" ? "ok" : j.status === "failed" ? "urgent" : j.status === "partial" ? "warn" : "neutral"}>{j.status}</Badge>
                        {err && <div className="mt-1 max-w-sm text-xs text-ink-2">{err}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </section>
      </>
    );
  });
}
