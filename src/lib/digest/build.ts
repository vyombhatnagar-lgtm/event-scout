import type { EventView } from "@/lib/services/events";

export interface DigestContent {
  weekStart: string;
  generatedAt: Date;
  ranked: EventView[];
  urgent: EventView[];
  totalRelevant: number;
  tasks: { label: string; detail: string | null }[];
  sourceNote: string;
  prefsNote: string;
  dashboardUrl: string;
  appUrl: string;
  calendlyUrl: string | null;
}

export const DIGEST_MAX_EVENTS = 12;

/**
 * Pick what goes in the digest:
 *  - urgent: relevant OR already saved events whose registration closes within 7 days
 *  - ranked: the top relevant events in the next 30 days (≥ minScore)
 * Events whose deadline has passed are excluded from "ranked" unless a source says registration is open.
 */
export function selectDigestEvents(all: EventView[], minScore: number) {
  const events = all.filter((e) => e.status !== "dismissed"); // "Not for me" never comes back
  const relevant = events.filter(
    (e) => e.score != null && e.score >= minScore && !(e.deadlineState.kind === "closed" && e.registrationOpen !== true),
  );
  const urgent = events
    .filter((e) => e.deadlineState.kind === "urgent" && ((e.score ?? 0) >= minScore || e.status === "saved" || e.status === "to_register"))
    .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime());
  const urgentIds = new Set(urgent.map((e) => e.id));
  const ranked = relevant.filter((e) => !urgentIds.has(e.id)).slice(0, DIGEST_MAX_EVENTS);
  return { urgent, ranked, totalRelevant: relevant.length };
}
