/** Words that make an explicit deadline plausible, avoids spending AI calls on text that cannot contain one. */
export const DEADLINE_HINT =
  /\b(registers?|registrations?|rsvps?|apply|applications?|tickets?|sales?|entries)\b[^.]{0,80}\b(by|before|until|till|closes?|closing|deadline|ends?)\b|\b(deadline|last date|closes?|closing)\b[^.]{0,60}\b(register|registration|rsvp|apply|application|tickets?)/i;

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/** True when `quote` (normalised for whitespace and quote marks) appears in `text`. */
export function verifyQuote(quote: string | null | undefined, text: string): boolean {
  if (!quote || quote.trim().length < 3) return false;
  return squash(text).includes(squash(quote));
}

/**
 * Guard against hallucinated deadlines. A model extracted deadline is accepted only if:
 *  - it parses as a date,
 *  - its evidence quote actually appears in the source text,
 *  - it is not after the event starts (a "deadline" after the event is a misread).
 */
export function verifyDeadlineEvidence(
  r: { deadline: string | null; evidence: string | null },
  sourceText: string,
  eventStart: Date,
): { deadline: Date | null; evidence: string | null; rejected?: string } {
  if (!r.deadline) return { deadline: null, evidence: null };
  const d = new Date(r.deadline);
  if (Number.isNaN(d.getTime())) return { deadline: null, evidence: null, rejected: "unparseable date" };
  if (!r.evidence || r.evidence.trim().length < 8) return { deadline: null, evidence: null, rejected: "no evidence quote" };
  if (!verifyQuote(r.evidence, sourceText)) return { deadline: null, evidence: null, rejected: "evidence not found in source text" };
  if (d.getTime() > eventStart.getTime()) return { deadline: null, evidence: null, rejected: "deadline after event start" };
  return { deadline: d, evidence: r.evidence.trim() };
}
