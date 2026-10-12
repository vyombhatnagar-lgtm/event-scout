import "server-only";
import { z } from "zod";
import { EVENT_FORMATS, type CandidateEventInput } from "@/types/event";
import { canonicalCity } from "@/lib/discovery/cities";
import { verifyDeadlineEvidence, verifyQuote } from "./evidence";
import { generateStructured } from "./gemini";

const Output = z.object({
  events: z.array(
    z.object({
      title: z.string().min(3).max(300),
      start: z.string(),
      end: z.string().nullable(),
      date_evidence: z.string().max(300),
      city: z.string().max(80).nullable(),
      venue: z.string().max(300).nullable(),
      format: z.enum(EVENT_FORMATS),
      organiser: z.string().max(200).nullable(),
      url: z.string().max(1000).nullable(),
      registration_deadline: z.string().nullable(),
      deadline_evidence: z.string().max(400).nullable(),
      description: z.string().max(600).nullable(),
    }),
  ),
});

const schema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event name exactly as written in the text" },
          start: { type: "string", description: "ISO 8601 start with offset; assume +05:30 when the text gives no zone; use T00:00 if no time is given" },
          end: { type: ["string", "null"] },
          date_evidence: { type: "string", description: "The exact words from the text that state the event date, copied verbatim" },
          city: { type: ["string", "null"] },
          venue: { type: ["string", "null"] },
          format: { type: "string", enum: [...EVENT_FORMATS] },
          organiser: { type: ["string", "null"] },
          url: { type: ["string", "null"], description: "Event or registration link if present in the text, else null" },
          registration_deadline: { type: ["string", "null"], description: "Only if the text states when registration closes; else null" },
          deadline_evidence: { type: ["string", "null"], description: "Verbatim sentence stating the registration deadline, else null" },
          description: { type: ["string", "null"], description: "One factual sentence from the text about the event" },
        },
        required: ["title", "start", "end", "date_evidence", "city", "venue", "format", "organiser", "url", "registration_deadline", "deadline_evidence", "description"],
      },
    },
  },
  required: ["events"],
};

const SYSTEM = `You extract upcoming professional EVENTS (conferences, summits, roundtables, meetups, workshops, webinars) from web pages, newsletters and posts.
Only return events whose name AND date are explicitly stated in the text. Never guess a date, a city, a speaker or a deadline.
Ignore past events, job posts, product launches and news that are not events someone can attend or register for.
Copy "title", "date_evidence" and "deadline_evidence" verbatim from the text. If nothing qualifies, return an empty list.`;

export interface ExtractContext {
  sourceName: string;
  pageUrl: string;
  text: string;
  now: Date;
  /** Upper bound for event start (the discovery window). */
  until: Date;
}

export interface ExtractResult {
  candidates: CandidateEventInput[];
  rejected: string[];
}

/**
 * Gemini Flash turns free text (a page, a newsletter item, a pasted LinkedIn post) into events.
 * Every event is checked against the text: title and date quote must appear verbatim, the date must
 * parse and fall in the window, and a deadline needs its own verbatim evidence.
 */
export async function extractEventsFromText(ctx: ExtractContext): Promise<ExtractResult> {
  const text = ctx.text.slice(0, 12_000);
  const out = await generateStructured({
    system: SYSTEM,
    prompt: `Today is ${ctx.now.toISOString().slice(0, 10)}. Source: ${ctx.sourceName} (${ctx.pageUrl}).\n\nTEXT:\n${text}`,
    jsonSchema: schema,
    validator: Output,
  });
  const candidates: CandidateEventInput[] = [];
  const rejected: string[] = [];
  for (const e of out.events) {
    if (!verifyQuote(e.title, text)) {
      rejected.push(`"${e.title.slice(0, 60)}": title not found in source text`);
      continue;
    }
    if (!verifyQuote(e.date_evidence, text)) {
      rejected.push(`"${e.title.slice(0, 60)}": date not found in source text`);
      continue;
    }
    const start = new Date(e.start);
    if (Number.isNaN(start.getTime()) || start < new Date(ctx.now.getTime() - 86_400_000) || start > ctx.until) {
      rejected.push(`"${e.title.slice(0, 60)}": date outside the next 30 days`);
      continue;
    }
    const end = e.end ? new Date(e.end) : null;
    const dl = verifyDeadlineEvidence({ deadline: e.registration_deadline, evidence: e.deadline_evidence }, text, start);
    const url = e.url && /^https?:\/\//i.test(e.url) ? e.url : ctx.pageUrl;
    candidates.push({
      sourceName: ctx.sourceName,
      sourceEventId: `${url}#${e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}-${e.start.slice(0, 10)}`,
      sourceUrl: ctx.pageUrl,
      title: e.title,
      description: e.description,
      startAt: start,
      endAt: end && !Number.isNaN(end.getTime()) && end >= start ? end : null,
      allDay: /T00:00(:00)?/.test(e.start),
      timezone: "Asia/Kolkata",
      venue: e.venue,
      city: canonicalCity(e.city),
      country: null,
      format: e.format,
      organiser: e.organiser,
      eventUrl: url,
      registrationUrl: url,
      statedDeadline: dl.deadline,
      registrationOpen: null,
      priceText: null,
    });
  }
  return { candidates, rejected };
}
