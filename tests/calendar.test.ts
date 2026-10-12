import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, icsEscape, icsFold, type CalendarEvent } from "@/lib/calendar/ics";

const now = new Date("2026-10-12T03:30:00Z");
const base: CalendarEvent = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "CXO Roundtable; Strategy, Ops",
  startAt: new Date("2026-10-20T12:30:00Z"),
  endAt: null,
  allDay: false,
  location: "Indiranagar, Bengaluru",
  url: "https://www.eventbrite.com/e/x-tickets-1",
  sourceUrl: "https://www.eventbrite.com/e/x-tickets-1",
  summary: "Invite-only evening.",
  deadline: new Date("2026-10-16T18:30:00Z"),
};

describe("calendar export", () => {
  it("builds a valid timed event with a separate deadline reminder", () => {
    const ics = buildIcs(base, now);
    expect(ics).toContain("DTSTART:20261020T123000Z");
    expect(ics).toContain("DTEND:20261020T143000Z"); // 2h default when no end time
    expect(ics).toContain("SUMMARY:CXO Roundtable\\; Strategy\\, Ops");
    expect(ics).toContain("UID:deadline-11111111-1111-1111-1111-111111111111@event-scout");
    expect(ics).toContain("DTEND:20261016T183000Z");
    expect(ics).toContain("TRIGGER:-PT24H");
    expect(ics.split("BEGIN:VEVENT")).toHaveLength(3);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("omits the reminder when the deadline is unknown or passed", () => {
    expect(buildIcs({ ...base, deadline: null }, now).split("BEGIN:VEVENT")).toHaveLength(2);
    expect(buildIcs({ ...base, deadline: new Date("2026-10-01T00:00:00Z") }, now).split("BEGIN:VEVENT")).toHaveLength(2);
  });
  it("uses IST dates for all-day events", () => {
    const ics = buildIcs({ ...base, allDay: true, startAt: new Date("2026-10-22T18:30:00Z") }, now); // = 23 Oct IST midnight
    expect(ics).toContain("DTSTART;VALUE=DATE:20261023");
    expect(ics).toContain("DTEND;VALUE=DATE:20261024");
  });
  it("escapes and folds long lines", () => {
    expect(icsEscape("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    const folded = icsFold(`DESCRIPTION:${"x".repeat(200)}`);
    expect(folded.split("\r\n ").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
  it("builds a Google Calendar link", () => {
    const u = new URL(googleCalendarUrl(base));
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("dates")).toBe("20261020T123000Z/20261020T143000Z");
    expect(u.searchParams.get("text")).toBe(base.title);
  });
});
