import "server-only";
import { z } from "zod";
import { verifyDeadlineEvidence, verifyQuote } from "@/lib/ai/evidence";
import { AiError, generateStructured } from "@/lib/ai/gemini";
import { localDate } from "@/lib/time";
import type { CandidateEventInput } from "@/types/event";
import { canonicalCity } from "../cities";
import { normaliseTitle } from "../normalise";
import { htmlToText, ldToCandidate } from "./content";
import { extractLdEvents, stripQuery } from "./jsonld";
import { type Connector, QUOTA_NOTE, errMsg, fetchText, sleep } from "./types";

const SOURCE = "Web search (Gemini)";
const MAX_RESULTS = 12;

const Output = z.object({
  events: z
    .array(
      z.object({
        title: z.string().min(3).max(300),
        start: z.string(),
        city: z.string().nullable(),
        organiser: z.string().nullable(),
        url: z.string(),
        registration_deadline: z.string().nullable(),
        deadline_evidence: z.string().nullable(),
      }),
    )
    .max(20),
});

const schema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          start: { type: "string", description: "ISO 8601 with +05:30 offset" },
          city: { type: ["string", "null"] },
          organiser: { type: ["string", "null"] },
          url: { type: "string", description: "Direct link to the event or registration page (not a search or news link)" },
          registration_deadline: { type: ["string", "null"] },
          deadline_evidence: { type: ["string", "null"], description: "Exact sentence from the event page stating the deadline" },
        },
        required: ["title", "start", "city", "organiser", "url", "registration_deadline", "deadline_evidence"],
      },
    },
  },
  required: ["events"],
};

const SYSTEM = `You are an event researcher for an independent management consultant in India.
Use Google Search to find real, upcoming, in person professional events. Only include events you found on an actual web page with a clear name, date and link.
Never invent events, dates, links or deadlines. If unsure, leave it out.`;

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** True if the page text mentions the event's calendar date in a common format (IST). */
export function pageMentionsDate(text: string, start: Date): boolean {
  const [y, m, d] = localDate(start).split("-").map(Number);
  const full = MONTHS[m - 1];
  const short = full.slice(0, 3);
  const t = text.toLowerCase();
  const patterns = [
    new RegExp(`\\b0?${d}(st|nd|rd|th)?\\s+(${full}|${short}\\.?)\\b`),
    new RegExp(`\\b(${full}|${short}\\.?)\\s+0?${d}(st|nd|rd|th)?\\b`),
    new RegExp(`\\b0?${d}[/.-]0?${m}[/.-](${y}|${String(y).slice(2)})\\b`),
    new RegExp(`\\b${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`),
  ];
  return patterns.some((p) => p.test(t));
}

/**
 * Gemini Flash with Google Search finds events announced anywhere (organiser sites, public
 * LinkedIn event pages, association calendars). Nothing is trusted from the model alone: each
 * result's page is fetched, and the event is kept only if the page shows its title and date.
 */
export const webSearch: Connector = {
  name: SOURCE,
  method: "Gemini Flash + Google Search; every result verified against its own page (title and date must appear)",
  async fetch({ cities, windowStart, windowEnd, focus }) {
    const errors: string[] = [];
    const candidates: CandidateEventInput[] = [];
    const from = localDate(windowStart);
    const to = localDate(windowEnd);
    const prompt = `Find up to ${MAX_RESULTS} upcoming in person events between ${from} and ${to} in ${cities.map((c) => c.name).join(", ")} (India).
Focus: ${(focus?.categories ?? []).join(", ")}. Topics: ${(focus?.topics ?? []).join(", ")}.
Prioritise CXO/CIO/CFO roundtables, leadership summits, industry conferences and startup-ecosystem events where senior decision makers attend, including ones announced on LinkedIn, iSPIRT, NASSCOM, TiE, CII, FICCI or organiser websites.`;

    let found: z.infer<typeof Output>["events"];
    try {
      found = (await generateStructured({ system: SYSTEM, prompt, jsonSchema: schema, validator: Output, googleSearch: true, attempts: 2, timeoutMs: 120_000 })).events;
    } catch (e) {
      if (e instanceof AiError && e.kind === "rate_limit") return { candidates, errors: [], deferred: QUOTA_NOTE };
      return { candidates, errors: [`search: ${errMsg(e)}`] };
    }

    for (const [i, r] of found.slice(0, MAX_RESULTS).entries()) {
      if (i > 0) await sleep(800);
      if (!/^https?:\/\//i.test(r.url) || /google\.com\/(search|url)|vertexaisearch/i.test(r.url)) {
        errors.push(`"${r.title.slice(0, 50)}": no direct link`);
        continue;
      }
      const url = stripQuery(r.url);
      let html: string;
      try {
        html = await fetchText(url, 15_000);
      } catch (e) {
        errors.push(`"${r.title.slice(0, 50)}": page not reachable (${errMsg(e)})`);
        continue;
      }
      // Prefer the page's own structured data when it describes this event.
      const ld = extractLdEvents(html).find((e) => e.name && normaliseTitle(e.name) === normaliseTitle(r.title));
      if (ld) {
        const c = ldToCandidate(ld, SOURCE, url);
        if (c && c.startAt >= windowStart && c.startAt <= windowEnd) candidates.push({ ...c, sourceUrl: url, eventUrl: url, registrationUrl: url, sourceEventId: url });
        continue;
      }
      const text = htmlToText(html);
      const start = new Date(r.start);
      if (Number.isNaN(start.getTime()) || start < windowStart || start > windowEnd) {
        errors.push(`"${r.title.slice(0, 50)}": date outside the window`);
        continue;
      }
      if (!verifyQuote(r.title, text) || !pageMentionsDate(text, start)) {
        errors.push(`"${r.title.slice(0, 50)}": title or date not found on ${new URL(url).hostname}`);
        continue;
      }
      const dl = verifyDeadlineEvidence({ deadline: r.registration_deadline, evidence: r.deadline_evidence }, text, start);
      candidates.push({
        sourceName: SOURCE,
        sourceEventId: url,
        sourceUrl: url,
        title: r.title,
        description: null,
        startAt: start,
        endAt: null,
        allDay: /T00:00/.test(r.start),
        timezone: "Asia/Kolkata",
        venue: null,
        city: canonicalCity(r.city),
        country: "IN",
        format: "in_person",
        organiser: r.organiser,
        eventUrl: url,
        registrationUrl: url,
        statedDeadline: dl.deadline,
        registrationOpen: null,
        priceText: null,
      });
    }
    return { candidates, errors };
  },
};
