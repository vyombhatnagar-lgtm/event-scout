import type { CandidateEvent } from "@/types/event";
import { dedupeKey } from "./normalise";

export interface MergedCandidate {
  key: string;
  /** Best record: the one with the most populated fields, preferring timed over date only. */
  primary: CandidateEvent;
  /** Every source reference that described this event (kept, never discarded). */
  sources: CandidateEvent[];
}

const completeness = (e: CandidateEvent) =>
  [e.description, e.venue, e.city, e.organiser, e.endAt, e.statedDeadline, e.priceText, e.timezone].filter(Boolean).length +
  (e.allDay ? 0 : 2) +
  (e.format !== "unknown" ? 1 : 0);

/**
 * Within batch duplicate detection, in order of confidence:
 *  1. same source + source ID      → same listing seen twice
 *  2. same canonical event URL     → same page
 *  3. same dedupe key (title + date + city) → same event on different sites
 */
export function deduplicate(events: CandidateEvent[]): MergedCandidate[] {
  const groups: MergedCandidate[] = [];
  const bySourceId = new Map<string, MergedCandidate>();
  const byUrl = new Map<string, MergedCandidate>();
  const byKey = new Map<string, MergedCandidate>();

  for (const e of events) {
    const sid = `${e.sourceName}:${e.sourceEventId}`;
    const key = dedupeKey(e);
    const group = bySourceId.get(sid) ?? byUrl.get(e.eventUrl) ?? byKey.get(key);
    if (group) {
      if (!group.sources.some((s) => s.sourceName === e.sourceName && s.sourceEventId === e.sourceEventId)) group.sources.push(e);
      if (completeness(e) > completeness(group.primary)) group.primary = e;
    } else {
      const g: MergedCandidate = { key, primary: e, sources: [e] };
      groups.push(g);
      byKey.set(key, g);
    }
    const g = group ?? byKey.get(key)!;
    bySourceId.set(sid, g);
    byUrl.set(e.eventUrl, g);
    if (!byKey.has(key)) byKey.set(key, g);
  }
  return groups;
}
