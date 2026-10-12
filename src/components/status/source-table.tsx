import { Badge, EmptyState } from "@/components/shared/ui";
import type { latestSourceRuns } from "@/lib/services/events";
import { formatDate } from "@/lib/time";

export function SourceTable({ rows }: { rows: Awaited<ReturnType<typeof latestSourceRuns>>["rows"] }) {
  if (rows.length === 0) return <EmptyState title="No source runs yet">Run discovery to fetch from Luma, Eventbrite and Meetup.</EmptyState>;
  const fmt = (s: string | null) => (s ? formatDate(new Date(s), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "Never");
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-muted uppercase">
            <th scope="col" className="px-4 py-3 font-semibold">Source</th>
            <th scope="col" className="px-4 py-3 font-semibold">Last success</th>
            <th scope="col" className="px-4 py-3 font-semibold">Retrieved</th>
            <th scope="col" className="px-4 py-3 font-semibold">Accepted</th>
            <th scope="col" className="px-4 py-3 font-semibold">Latest run</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.source_name} className="border-t border-line-2 align-top">
              <td className="px-4 py-3 font-medium">{r.source_name}</td>
              <td className="px-4 py-3 font-mono text-[13px]">{fmt(r.last_success)}</td>
              <td className="px-4 py-3 font-mono text-[13px]">{r.retrieved}</td>
              <td className="px-4 py-3 font-mono text-[13px]">{r.accepted}</td>
              <td className="px-4 py-3">
                <Badge tone={r.status === "success" ? "ok" : r.status === "failed" ? "urgent" : r.status === "partial" ? "warn" : "neutral"}>
                  {r.status === "partial" && r.errors[0]?.startsWith("Waiting for Gemini quota")
                    ? "Waiting for AI quota"
                    : r.status === "partial"
                      ? `Partial · ${r.errors.length} issue${r.errors.length === 1 ? "" : "s"}`
                      : r.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
