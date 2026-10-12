import "server-only";
import { extractEventsFromText } from "@/lib/ai/extract-events";
import { setPipelineStatus } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";
import { discoveryWindow } from "@/lib/time";
import type { CandidateEventInput } from "@/types/event";
import { htmlToText, ldToCandidate } from "./connectors/content";
import { extractLdEvents } from "./connectors/jsonld";
import { errMsg, fetchText } from "./connectors/types";
import { persistCandidates } from "./pipeline";

export const CAPTURE_SOURCE = "Added by you";

export class CaptureError extends Error {}

/** Sites that require sign in to read, the user must paste the text instead. */
const LOGIN_WALLED = /(^|\.)linkedin\.com$|(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/i;

/**
 * Turn one link (and/or pasted text) into tracked events, for announcements that only
 * appeared on LinkedIn, in an email or a newsletter. Structured data is used when the page
 * has it; otherwise Gemini Flash extracts the event and every field is checked against the text.
 * Captured events are saved straight into the pipeline.
 */
export async function captureEvent(input: { url: string; text?: string | null }) {
  const now = new Date();
  const { to } = discoveryWindow(now);
  const url = new URL(input.url);
  let candidates: CandidateEventInput[] = [];
  let rejected: string[] = [];
  let text = input.text?.trim() || "";

  if (!text) {
    if (LOGIN_WALLED.test(url.hostname)) {
      throw new CaptureError(`${url.hostname} needs a sign in to read. Paste the post text as well and try again.`);
    }
    let html: string;
    try {
      html = await fetchText(url.toString(), 20_000);
    } catch (e) {
      throw new CaptureError(`Could not open that link (${errMsg(e)}). Paste the event text instead.`);
    }
    candidates = extractLdEvents(html)
      .map((e) => ldToCandidate(e, CAPTURE_SOURCE, url.toString()))
      .filter((c): c is CandidateEventInput => !!c);
    if (candidates.length === 0) text = htmlToText(html);
  }

  if (candidates.length === 0) {
    if (text.length < 20) throw new CaptureError("Not enough text to find an event. Paste the full announcement.");
    const r = await extractEventsFromText({ sourceName: CAPTURE_SOURCE, pageUrl: url.toString(), text, now, until: new Date(to.getTime() + 60 * 86_400_000) });
    candidates = r.candidates;
    rejected = r.rejected;
  }
  // Captured links keep the user's URL as the source reference.
  candidates = candidates.map((c) => ({ ...c, sourceName: CAPTURE_SOURCE, sourceUrl: url.toString() }));
  if (candidates.length === 0) {
    throw new CaptureError(rejected[0] ? `No verifiable event found, ${rejected[0]}.` : "No upcoming event with a clear name and date was found in that text.");
  }

  const { ids, rejected: invalid } = await persistCandidates(candidates);
  const user = await getUser();
  for (const id of ids) await setPipelineStatus(user.id, id, "saved");
  return { ids, rejected: [...rejected, ...invalid] };
}
