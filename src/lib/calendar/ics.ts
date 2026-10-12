/**
 * Calendar export without OAuth: an RFC 5545 .ics file (Google, Outlook, Apple) and a
 * Google Calendar "add event" link. Adding to a calendar never changes pipeline status.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  location: string | null;
  url: string | null;
  sourceUrl: string | null;
  summary: string | null;
  deadline: Date | null;
}

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
/** Calendar date in IST for all-day events (sources give only a date). */
const istDate = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10).replace(/-/g, "");

export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets as the spec requires. */
export function icsFold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function eventTimes(e: CalendarEvent): { start: string; end: string } {
  if (e.allDay) {
    const end = e.endAt && e.endAt > e.startAt ? e.endAt : e.startAt;
    return { start: `;VALUE=DATE:${istDate(e.startAt)}`, end: `;VALUE=DATE:${istDate(new Date(end.getTime() + DAY))}` };
  }
  const end = e.endAt && e.endAt > e.startAt ? e.endAt : new Date(e.startAt.getTime() + 2 * 3_600_000);
  return { start: `:${utcStamp(e.startAt)}`, end: `:${utcStamp(end)}` };
}

function description(e: CalendarEvent): string {
  return [e.summary, e.url ? `Register: ${e.url}` : null, e.sourceUrl && e.sourceUrl !== e.url ? `Source: ${e.sourceUrl}` : null, "Added from Event Scout"]
    .filter(Boolean)
    .join("\n");
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  const t = eventTimes(e);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Scout//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${e.id}@event-scout`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART${t.start}`,
    `DTEND${t.end}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location ? `LOCATION:${icsEscape(e.location)}` : null,
    `DESCRIPTION:${icsEscape(description(e))}`,
    e.url ? `URL:${e.url}` : null,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Tomorrow: ${e.title}`)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
  ];
  if (e.deadline && e.deadline.getTime() > now.getTime()) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:deadline-${e.id}@event-scout`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(new Date(e.deadline.getTime() - 30 * 60_000))}`,
      `DTEND:${utcStamp(e.deadline)}`,
      `SUMMARY:${icsEscape(`Registration closes: ${e.title}`)}`,
      `DESCRIPTION:${icsEscape(e.url ? `Register before it closes: ${e.url}` : "Registration deadline")}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(`Registration closes in 24 hours: ${e.title}`)}`,
      "TRIGGER:-PT24H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.filter((l): l is string => l !== null).map(icsFold).join("\r\n") + "\r\n";
}

/** Google Calendar "create event" link — opens a pre-filled event for the signed-in Google user. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const t = eventTimes(e);
  const strip = (s: string) => s.replace(/^;VALUE=DATE:|^:/, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${strip(t.start)}/${strip(t.end)}`,
    details: description(e),
  });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}
