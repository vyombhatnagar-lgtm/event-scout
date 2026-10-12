import type { CandidateEventInput } from "@/types/event";
import { zonedMidnight } from "@/lib/time";
import { canonicalCity, knownCity } from "../cities";
import { cleanText } from "../normalise";
import { type LdEvent, isDateOnly, ldFormat, ldImage, ldOrganiser, ldPlace, ldPrice, stripQuery } from "./jsonld";

export type ContentKind = "ical" | "feed" | "html";

export function detectKind(body: string): ContentKind {
  const head = body.slice(0, 2000).trimStart();
  if (head.startsWith("BEGIN:VCALENDAR")) return "ical";
  if (/^(<\?xml[^>]*>\s*)?<(rss|feed|rdf:RDF)\b/i.test(head)) return "feed";
  return "html";
}

/** Readable text from an HTML page (scripts, styles, nav chrome removed). */
export function htmlToText(html: string): string {
  return (
    cleanText(
      html
        .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, "\n"),
    ) ?? ""
  );
}

/** RSS/Atom items flattened to text blocks (newest first), for event extraction. */
export function feedToText(xml: string, maxItems = 15): string {
  const items = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const pick = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return m ? (cleanText(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")) ?? "") : "";
  };
  return items
    .slice(0, maxItems)
    .map((b) => {
      const link = pick(b, "link") || b.match(/<link[^>]*href="([^"]+)"/i)?.[1] || "";
      const body = (pick(b, "description") || pick(b, "summary") || pick(b, "content:encoded") || pick(b, "content")).slice(0, 700);
      return [`TITLE: ${pick(b, "title")}`, link ? `LINK: ${link}` : "", `PUBLISHED: ${pick(b, "pubDate") || pick(b, "published") || pick(b, "updated")}`, body].filter(Boolean).join("\n");
    })
    .join("\n\n---\n\n");
}

/** Parse an iCal date value: 20261020T123000Z · 20261020T180000 (+TZID) · 20261020 (date only). */
export function parseIcalDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) {
    const ymd = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return { date: zonedMidnight(ymd), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  // Floating or TZID time: IST unless the zone says UTC (good enough for Indian event calendars).
  const offsetMin = /TZID=(UTC|GMT|Etc\/UTC)/i.test(params) ? 0 : 330;
  return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - offsetMin * 60_000), allDay: false };
}

const icalUnescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Deterministic iCal parsing, no AI needed. */
export function parseIcal(body: string, sourceName: string, feedUrl: string): CandidateEventInput[] {
  const lines = body.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: CandidateEventInput[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const start = cur.DTSTART && parseIcalDate(cur.DTSTART.value, cur.DTSTART.params);
      const title = cur.SUMMARY && icalUnescape(cur.SUMMARY.value);
      if (start && title) {
        const end = cur.DTEND && parseIcalDate(cur.DTEND.value, cur.DTEND.params);
        const url = cur.URL?.value && /^https?:\/\//.test(cur.URL.value) ? cur.URL.value : feedUrl;
        const location = cur.LOCATION ? icalUnescape(cur.LOCATION.value) : null;
        out.push({
          sourceName,
          sourceEventId: cur.UID?.value || `${title}-${start.date.toISOString()}`,
          sourceUrl: feedUrl,
          title,
          description: cur.DESCRIPTION ? icalUnescape(cur.DESCRIPTION.value) : null,
          startAt: start.date,
          endAt: end && end.date >= start.date ? end.date : null,
          allDay: start.allDay,
          timezone: "Asia/Kolkata",
          venue: location,
          city: location?.split(",").map((p) => knownCity(p)).find(Boolean) ?? null,
          country: null,
          format: location && /online|zoom|meet\.google|teams/i.test(location) ? "online" : location ? "in_person" : "unknown",
          organiser: cur.ORGANIZER?.params.match(/CN=([^;:]+)/)?.[1] ?? null,
          eventUrl: url,
          registrationUrl: url,
          statedDeadline: null,
          registrationOpen: null,
          priceText: null,
        });
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const [name, ...params] = line.slice(0, idx).split(";");
        cur[name.toUpperCase()] = { value: line.slice(idx + 1), params: params.join(";") };
      }
    }
  }
  return out;
}

/** Map a generic schema.org Event (from any page) to a candidate. */
export function ldToCandidate(ev: LdEvent, sourceName: string, pageUrl: string): CandidateEventInput | null {
  if (!ev.name || !ev.startDate) return null;
  const dateOnly = isDateOnly(ev.startDate);
  const startAt = dateOnly ? zonedMidnight(ev.startDate) : new Date(ev.startDate);
  if (Number.isNaN(startAt.getTime())) return null;
  const endRaw = ev.endDate ? (isDateOnly(ev.endDate) ? new Date(zonedMidnight(ev.endDate).getTime() + 86_399_000) : new Date(ev.endDate)) : null;
  const place = ldPlace(ev);
  const url = ev.url && /^https?:\/\//.test(ev.url) ? stripQuery(ev.url) : pageUrl;
  return {
    sourceName,
    sourceEventId: url !== pageUrl ? url : `${ev.name}-${ev.startDate}`,
    sourceUrl: url,
    title: ev.name,
    description: ev.description ?? null,
    startAt,
    endAt: endRaw && !Number.isNaN(endRaw.getTime()) && endRaw >= startAt ? endRaw : null,
    allDay: dateOnly,
    timezone: "Asia/Kolkata",
    venue: place.venue,
    city: canonicalCity(place.city),
    country: place.country,
    format: ldFormat(ev.eventAttendanceMode),
    organiser: ldOrganiser(ev),
    eventUrl: url,
    registrationUrl: url,
    statedDeadline: null,
    registrationOpen: null,
    priceText: ldPrice(ev),
    imageUrl: ldImage(ev),
  };
}
