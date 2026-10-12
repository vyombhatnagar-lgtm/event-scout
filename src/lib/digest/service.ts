import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { digestSubject, renderDigestHtml, renderDigestText } from "@/lib/email/templates/digest";
import { syncWeeklyTasks } from "@/lib/services/checklist";
import { latestSourceRuns, listWindowEvents } from "@/lib/services/events";
import { getPreferences, getUser } from "@/lib/services/user";
import { formatDate, weekStart } from "@/lib/time";
import { type DigestContent, selectDigestEvents } from "./build";

export function appUrl() {
  return (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");
}

export async function buildDigest(now = new Date()): Promise<{ content: DigestContent; recipient: string | null; enabled: boolean; userId: string }> {
  const user = await getUser();
  const prefs = await getPreferences(user.id);
  const [events, tasks, runs] = await Promise.all([
    listWindowEvents(user.id, now),
    syncWeeklyTasks(user.id, prefs, now),
    latestSourceRuns(),
  ]);
  const { urgent, ranked, totalRelevant } = selectDigestEvents(events, prefs.minScore);
  const ok = runs.rows.filter((r) => r.last_success).map((r) => r.source_name);
  const failed = runs.rows.filter((r) => r.status === "failed").map((r) => r.source_name);
  const sourceNote = `Sources checked: ${ok.join(", ") || "none yet"}${failed.length ? ` (latest run failed: ${failed.join(", ")})` : ""}.`;
  const prefsNote = `Ranked by Gemini Flash against your preferences (${prefs.topics.slice(0, 4).join(", ")}${prefs.topics.length > 4 ? "…" : ""} · ${prefs.cities.join(", ")}; minimum fit ${prefs.minScore}).`;
  // When DIGEST_RECIPIENT_EMAIL is configured, the digest only ever goes there — so an open
  // (password-less) deployment cannot be used to send email to arbitrary addresses.
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL?.trim() || prefs.digestEmail;
  return {
    userId: user.id,
    recipient,
    enabled: prefs.digestEnabled,
    content: {
      weekStart: weekStart(now),
      generatedAt: now,
      urgent,
      ranked,
      totalRelevant,
      tasks: tasks.filter((t) => !t.done).slice(0, 6).map((t) => ({ label: t.label, detail: t.detail })),
      sourceNote,
      prefsNote,
      dashboardUrl: `${appUrl()}/dashboard`,
      calendlyUrl: prefs.calendlyUrl,
    },
  };
}

export type DigestOutcome =
  | { outcome: "sent"; runId: string; recipient: string; providerId: string | null }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; runId: string; error: string };

const STALE_SENDING_MS = 10 * 60_000;

/**
 * Send the digest at most once per key.
 *  scheduled → key "scheduled:<user>:<week>" — the Monday cron can fire or retry any number of times
 *  manual    → key "manual:<user>:<minute>" — a double click cannot double-send
 * A failed attempt may be retried; a sent one never is.
 */
export async function sendDigest(trigger: "scheduled" | "manual", now = new Date()): Promise<DigestOutcome> {
  const { content, recipient, enabled, userId } = await buildDigest(now);
  if (trigger === "scheduled" && !enabled) return { outcome: "skipped", reason: "Weekly digest is turned off in Preferences" };
  if (!recipient) return { outcome: "skipped", reason: "No digest recipient set in Preferences or DIGEST_RECIPIENT_EMAIL" };

  const key = trigger === "scheduled" ? `scheduled:${userId}:${content.weekStart}` : `manual:${userId}:${now.toISOString().slice(0, 16)}`;
  const d = db();

  const [created] = await d
    .insert(schema.digestRuns)
    .values({ userId, idempotencyKey: key, trigger, weekStart: content.weekStart, status: "sending", recipient })
    .onConflictDoNothing()
    .returning({ id: schema.digestRuns.id });

  let runId = created?.id;
  if (!runId) {
    const [existing] = await d.select().from(schema.digestRuns).where(eq(schema.digestRuns.idempotencyKey, key));
    if (!existing) return { outcome: "skipped", reason: "Could not create digest run" };
    if (existing.status === "sent") return { outcome: "skipped", reason: `Already sent for this ${trigger === "scheduled" ? "week" : "minute"} (${formatDate(existing.sentAt ?? existing.createdAt, { dateStyle: "medium", timeStyle: "short" })} IST)` };
    const stale = now.getTime() - existing.createdAt.getTime() > STALE_SENDING_MS;
    if (existing.status === "sending" && !stale) return { outcome: "skipped", reason: "A send for this digest is already in progress" };
    // Claim the retry atomically: only one concurrent caller can flip it back to "sending".
    const claimed = await d
      .update(schema.digestRuns)
      .set({ status: "sending", attempts: sql`${schema.digestRuns.attempts} + 1`, error: null, recipient, createdAt: now })
      .where(and(eq(schema.digestRuns.id, existing.id), eq(schema.digestRuns.status, existing.status)))
      .returning({ id: schema.digestRuns.id });
    if (claimed.length === 0) return { outcome: "skipped", reason: "Another process claimed this retry" };
    runId = existing.id;
  }

  const result = await sendEmail({
    to: recipient,
    subject: digestSubject(content),
    html: renderDigestHtml(content),
    text: renderDigestText(content),
    idempotencyKey: key,
  });

  await d.insert(schema.notificationLogs).values({
    digestRunId: runId,
    channel: "email",
    recipient,
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.id,
    error: result.error,
  });
  await d
    .update(schema.digestRuns)
    .set(
      result.ok
        ? { status: "sent", sentAt: new Date(), providerMessageId: result.id, eventCount: content.ranked.length + content.urgent.length, urgentCount: content.urgent.length }
        : { status: "failed", error: result.error },
    )
    .where(eq(schema.digestRuns.id, runId));

  return result.ok
    ? { outcome: "sent", runId, recipient, providerId: result.id }
    : { outcome: "failed", runId, error: result.error ?? "unknown error" };
}
