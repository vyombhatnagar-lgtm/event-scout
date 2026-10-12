import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { JobButton } from "@/components/shared/job-button";
import { renderOrError } from "@/components/shared/load";
import { Badge, Card, Notice, PageHeader, PageSkeleton, SectionTitle } from "@/components/shared/ui";
import { latestDigestRuns } from "@/lib/services/events";
import { getPreferences, getUser } from "@/lib/services/user";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Digest" };

export default function DigestPage() {
  return (
    <>
      <PageHeader
        title="Monday briefing"
        sub="Sent automatically every Monday at 06:30 IST, right after the 05:00 discovery run (with an 08:00 retry that only sends if 06:30 failed). The preview below is the live content."
        actions={<JobButton job="digest" label="Send me a test briefing" variant="primary" />}
      />
      <Suspense fallback={<PageSkeleton />}>
        <DigestInfo />
      </Suspense>
      <section aria-labelledby="prev-h" className="flex flex-col gap-3">
        <SectionTitle id="prev-h" aside={<a href="/api/digest/preview?format=text" target="_blank" rel="noopener noreferrer">Plain text version</a>}>
          Preview
        </SectionTitle>
        <iframe title="Digest email preview" src="/api/digest/preview" className="h-[1400px] w-full rounded-[22px] bg-[#F3F2EE] shadow-[var(--shadow-soft)]" />
      </section>
    </>
  );
}

async function DigestInfo() {
  await connection();
  return renderOrError(async () => {
    const user = await getUser();
    const [prefs, runs] = await Promise.all([getPreferences(user.id), latestDigestRuns(user.id)]);
    return (
      <div className="flex flex-col gap-4">
        {!prefs.digestEmail && (
          <Notice tone="urgent">
            <span>No recipient set. Add your email in <Link href="/settings">Preferences</Link>, the digest is never sent to any other address.</span>
          </Notice>
        )}
        {!prefs.digestEnabled && <Notice><span>The scheduled digest is turned off in Preferences. Test sends still work.</span></Notice>}
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <caption className="px-4 pt-4 text-left font-semibold">Delivery log</caption>
            <thead>
              <tr className="text-left text-xs tracking-wider text-muted uppercase">
                <th scope="col" className="px-4 py-3">When (IST)</th>
                <th scope="col" className="px-4 py-3">Trigger</th>
                <th scope="col" className="px-4 py-3">Recipient</th>
                <th scope="col" className="px-4 py-3">Events</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-muted">No digests sent yet.</td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line-2">
                  <td className="px-4 py-3 font-mono text-[13px]">{formatDate(r.sentAt ?? r.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                  <td className="px-4 py-3">{r.trigger}</td>
                  <td className="px-4 py-3">{r.recipient}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">{r.eventCount} ({r.urgentCount} urgent)</td>
                  <td className="px-4 py-3">
                    <Badge tone={r.status === "sent" ? "ok" : r.status === "failed" ? "urgent" : "warn"} title={r.error ?? undefined}>
                      {r.status}{r.attempts > 1 ? ` · ${r.attempts} attempts` : ""}
                    </Badge>
                    {r.error && <div className="mt-1 max-w-xs text-xs text-urgent">{r.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  });
}
