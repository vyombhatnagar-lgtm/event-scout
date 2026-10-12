import "server-only";
import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { extractEventsFromText } from "@/lib/ai/extract-events";
import { AiError } from "@/lib/ai/gemini";
import type { CandidateEventInput } from "@/types/event";
import { detectKind, feedToText, htmlToText, ldToCandidate, parseIcal } from "./content";
import { extractLdEvents } from "./jsonld";
import { type Connector, QUOTA_NOTE, errMsg, fetchText } from "./types";

const MAX_SOURCES_PER_RUN = 8;

/**
 * User configured sources (Preferences → Sources): conference sites, iSPIRT pages, newsletter
 * RSS/Atom feeds, iCal feeds. Structured data (iCal, schema.org) is parsed directly; free text
 * goes through Gemini Flash only when the content changed since the last run, to save quota.
 */
export const customSources: Connector = {
  name: "Custom sources",
  method: "Your added sites and feeds: iCal and schema.org parsed directly; pages and newsletters via Gemini Flash extraction (verified against the text)",
  async fetch({ windowEnd }) {
    const candidates: CandidateEventInput[] = [];
    const errors: string[] = [];
    let deferred: string | undefined;
    const rows = await db()
      .select()
      .from(schema.customSources)
      .where(eq(schema.customSources.enabled, true))
      .orderBy(asc(schema.customSources.lastCheckedAt))
      .limit(MAX_SOURCES_PER_RUN);

    for (const src of rows) {
      let status = "ok";
      let found = 0;
      let error: string | null = null;
      let hash = src.contentHash;
      try {
        const body = await fetchText(src.url, 20_000);
        const kind = detectKind(body);
        let list: CandidateEventInput[] = [];
        if (kind === "ical") {
          list = parseIcal(body, src.label, src.url);
        } else {
          const ld = kind === "html" ? extractLdEvents(body).map((e) => ldToCandidate(e, src.label, src.url)).filter((c): c is CandidateEventInput => !!c) : [];
          if (ld.length) list = ld;
          else {
            const text = kind === "feed" ? feedToText(body) : htmlToText(body);
            const next = createHash("sha256").update(text).digest("hex").slice(0, 24);
            if (next === src.contentHash) {
              status = "unchanged";
            } else {
              const r = await extractEventsFromText({ sourceName: src.label, pageUrl: src.url, text, now: new Date(), until: windowEnd });
              list = r.candidates;
              hash = next; // only remember the content once Gemini has processed it
              if (r.rejected.length) errors.push(...r.rejected.slice(0, 3).map((x) => `${src.label}: rejected ${x}`));
            }
          }
        }
        list = list.filter((c) => c.startAt <= windowEnd && c.startAt.getTime() >= Date.now() - 86_400_000);
        found = list.length;
        candidates.push(...list);
      } catch (e) {
        if (e instanceof AiError && e.kind === "rate_limit") {
          status = "waiting";
          error = QUOTA_NOTE;
          deferred = QUOTA_NOTE;
        } else {
          status = "error";
          error = errMsg(e).slice(0, 300);
          errors.push(`${src.label}: ${error}`);
        }
      }
      await db()
        .update(schema.customSources)
        .set({ lastCheckedAt: new Date(), lastStatus: status, lastError: error, contentHash: hash, ...(status === "unchanged" || status === "waiting" ? {} : { eventsFound: found }) })
        .where(eq(schema.customSources.id, src.id));
    }
    return { candidates, errors, deferred };
  },
};
