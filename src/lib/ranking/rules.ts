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
  location: number; // 0–25
  format: number; // 0–10
  topic: number; // 0–60
  timing: number; // 0–5
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
 * Topic fit dominates (60): being in the right city is necessary but not sufficient.
 * Weights: topic/category 60, location 25, format 10, timing 5.
 */
export function ruleScore(e: RankableEvent, p: Preferences, now: Date): RuleBreakdown {
  const inTargetCity = cityMatches(e.city, p.cities);
  const isOnline = e.format === "online";

  let location = 0;
  if (isOnline) location = p.formats.includes("online") ? 18 : 0;
  else if (inTargetCity) location = 25;

  let format = 0;
  if (p.formats.includes(e.format)) format = 10;
  else if (e.format === "unknown") format = 5;

  const text = `${e.title}\n${e.description ?? ""}\n${e.categories.join(" ")}`;
  const matchedTopics = [...p.topics, ...p.categories].filter((t) => topicMatches(t, text));
  const topic = [0, 35, 50, 60][Math.min(3, matchedTopics.length)];

  const timing = e.startAt.getTime() >= now.getTime() ? 5 : 0;

  return { location, format, topic, timing, total: location + format + topic + timing, matchedTopics, inTargetCity };
}

export const RULE_WEIGHT = 0.35;
export const AI_WEIGHT = 0.65;
/** Ceiling for events that fail a hard preference (wrong city, unwanted online). */
export const HARD_MISMATCH_CAP = 35;

/** Without Gemini, an event matching none of the user's topics cannot pass a typical minimum score. */
export const NO_TOPIC_CAP = 40;

/** Blend rules with Gemini's assessment; hard preference mismatches are capped so AI cannot override them. */
export function finalScore(rules: RuleBreakdown, aiScore: number | null, e: Pick<RankableEvent, "format">, p: Preferences): number {
  let score = aiScore == null ? rules.total : Math.round(RULE_WEIGHT * rules.total + AI_WEIGHT * aiScore);
  if (aiScore == null && rules.matchedTopics.length === 0) score = Math.min(score, NO_TOPIC_CAP);
  const wrongPlace = e.format !== "online" && !rules.inTargetCity;
  const unwantedOnline = e.format === "online" && !p.formats.includes("online");
  if (wrongPlace || unwantedOnline) score = Math.min(score, HARD_MISMATCH_CAP);
  return Math.max(0, Math.min(100, score));
}
