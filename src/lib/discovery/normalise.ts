import { type CandidateEvent, type CandidateEventInput, CandidateEventSchema } from "@/types/event";
import { localDate } from "@/lib/time";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Decode common HTML entities and strip tags, sources sometimes embed markup in text fields. */
export function cleanText(s: string | null | undefined): string | null {
  if (s == null) return null;
  const out = s
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#") && /^#\d+$/.test(e) && ENTITIES[e] === undefined) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out.length ? out : null;
}

export type NormaliseResult = { ok: true; event: CandidateEvent } | { ok: false; reason: string };

/** Clean and validate one connector record. Invalid records are rejected with a reason, never patched with guesses. */
export function normalise(raw: CandidateEventInput): NormaliseResult {
  const parsed = CandidateEventSchema.safeParse({
    ...raw,
    title: cleanText(raw.title) ?? "",
    description: cleanText(raw.description ?? null),
    venue: cleanText(raw.venue ?? null),
    organiser: cleanText(raw.organiser ?? null),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, reason: `${raw.sourceName}:${raw.sourceEventId}: ${issue.path.join(".")} ${issue.message}` };
  }
  return { ok: true, event: parsed.data };
}

const STOP = new Set(["the", "a", "an", "and", "of", "for", "in", "at", "on", "to", "with", "2025", "2026", "2027"]);

export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

/**
 * Cross source identity for an event: normalised title + local start DATE + city
 * (or "online"). Title similarity alone never merges two events, a matching
 * title on a different day or in a different city yields a different key.
 */
export function dedupeKey(e: Pick<CandidateEvent, "title" | "startAt" | "city" | "format">): string {
  const where = e.city ? e.city.toLowerCase().replace(/\s+/g, "-") : e.format === "online" ? "online" : "unknown";
  return `${normaliseTitle(e.title)}|${localDate(e.startAt)}|${where}`;
}
