import type { Preferences } from "@/types/preferences";
import type { EventFormat } from "@/types/event";
import { cityMatches } from "@/lib/discovery/cities";

export interface RankableEvent {
  title: string;
  description: string | null;
  city: string | null;
  format: EventFormat;
  categories: string[];
  startAt: Date;
}

export interface RuleBreakdown {
  location: number; // 0–35
  format: number; // 0–15
  topic: number; // 0–35
  timing: number; // 0–15
  total: number; // 0–100
  matchedTopics: string[];
  inTargetCity: boolean;
}

const SIGNIFICANT = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["and", "the", "for", "events", "event", "meetups"].includes(w));

/** A topic matches when every significant word in it appears (as a word prefix) in the text. */
export function topicMatches(topic: string, text: string): boolean {
  const words = SIGNIFICANT(topic);
  if (words.length === 0) return false;
  return words.every((w) => new RegExp(`\\b${w.replace(/[^a-z0-9]/g, "").slice(0, Math.max(4, w.length - 2))}`, "i").test(text));
}

/**
 * Deterministic half of the relevance score. Same inputs → same score, always.
 * Weights: location 35, topic/category 35, format 15, timing 15.
 */
export function ruleScore(e: RankableEvent, p: Preferences, now: Date): RuleBreakdown {
  const inTargetCity = cityMatches(e.city, p.cities);
  const isOnline = e.format === "online";

  let location = 0;
  if (isOnline) location = p.formats.includes("online") ? 25 : 0;
  else if (inTargetCity) location = 35;

  let format = 0;
  if (p.formats.includes(e.format)) format = 15;
  else if (e.format === "unknown") format = 7;

  const text = `${e.title}\n${e.description ?? ""}\n${e.categories.join(" ")}`;
  const matchedTopics = [...p.topics, ...p.categories].filter((t) => topicMatches(t, text));
  const topic = Math.min(35, matchedTopics.length * 12);

  const timing = e.startAt.getTime() >= now.getTime() ? 15 : 0;

  return { location, format, topic, timing, total: location + format + topic + timing, matchedTopics, inTargetCity };
}

export const RULE_WEIGHT = 0.35;
export const AI_WEIGHT = 0.65;
/** Ceiling for events that fail a hard preference (wrong city, unwanted online). */
export const HARD_MISMATCH_CAP = 35;

/** Blend rules with Gemini's assessment; hard preference mismatches are capped so AI cannot override them. */
export function finalScore(rules: RuleBreakdown, aiScore: number | null, e: Pick<RankableEvent, "format">, p: Preferences): number {
  let score = aiScore == null ? rules.total : Math.round(RULE_WEIGHT * rules.total + AI_WEIGHT * aiScore);
  const wrongPlace = e.format !== "online" && !rules.inTargetCity;
  const unwantedOnline = e.format === "online" && !p.formats.includes("online");
  if (wrongPlace || unwantedOnline) score = Math.min(score, HARD_MISMATCH_CAP);
  return Math.max(0, Math.min(100, score));
}
