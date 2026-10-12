import { describe, expect, it } from "vitest";
import { detectKind, feedToText, htmlToText, ldToCandidate, parseIcal, parseIcalDate } from "@/lib/discovery/connectors/content";
import { verifyQuote } from "@/lib/ai/evidence";

describe("custom source content", () => {
  it("detects iCal, feeds and HTML", () => {
    expect(detectKind("BEGIN:VCALENDAR\r\nVERSION:2.0")).toBe("ical");
    expect(detectKind('<?xml version="1.0"?>\n<rss version="2.0">')).toBe("feed");
    expect(detectKind('<feed xmlns="http://www.w3.org/2005/Atom">')).toBe("feed");
    expect(detectKind("<!doctype html><html>")).toBe("html");
  });

  it("parses iCal events deterministically, including folded lines and IST floating times", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:abc-1",
      "SUMMARY:CIO Roundtable\\, Bengaluru",
      "DTSTART;TZID=Asia/Kolkata:20261028T180000",
      "DTEND;TZID=Asia/Kolkata:20261028T200000",
      "LOCATION:Taj MG Road\\, Bengaluru",
      "URL:https://example.org/cio",
      "DESCRIPTION:Invite-only evening for CIOs. Registrations close on 2",
      " 5 October.",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Annual Summit",
      "DTSTART;VALUE=DATE:20261105",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [a, b] = parseIcal(ics, "Test feed", "https://example.org/cal.ics");
    expect(a.title).toBe("CIO Roundtable, Bengaluru");
    expect(a.startAt.toISOString()).toBe("2026-10-28T12:30:00.000Z");
    expect(a.city).toBe("Bengaluru");
    expect(a.eventUrl).toBe("https://example.org/cio");
    expect(a.description).toContain("close on 25 October");
    expect(a.statedDeadline).toBeNull(); // never inferred
    expect(b.allDay).toBe(true);
    expect(b.startAt.toISOString()).toBe("2026-11-04T18:30:00.000Z");
  });

  it("parses UTC iCal times", () => {
    expect(parseIcalDate("20261028T123000Z", "")?.date.toISOString()).toBe("2026-10-28T12:30:00.000Z");
  });

  it("flattens RSS items for extraction", () => {
    const xml = `<rss><channel><item><title>Playbook Roundtable: Pricing</title><link>https://pn.example/x</link><pubDate>Mon, 12 Oct 2026</pubDate><description><![CDATA[<p>Join us on <b>22 Oct</b> in Bengaluru.</p>]]></description></item></channel></rss>`;
    const t = feedToText(xml);
    expect(t).toContain("TITLE: Playbook Roundtable: Pricing");
    expect(t).toContain("LINK: https://pn.example/x");
    expect(t).toContain("Join us on 22 Oct in Bengaluru.");
  });

  it("strips scripts and markup from pages", () => {
    expect(htmlToText("<script>x=1</script><h1>NASSCOM&nbsp;Summit</h1><p>Mumbai</p>")).toBe("NASSCOM Summit\nMumbai");
  });

  it("maps schema.org events from any page", () => {
    const c = ldToCandidate({ name: "Fintech Forum", startDate: "2026-10-30T10:00:00+05:30", url: "https://allevents.in/x?ref=1", location: { "@type": "Place", name: "Hall", address: { addressLocality: "Bangalore" } } }, "AllEvents", "https://allevents.in/bangalore/business");
    expect(c?.city).toBe("Bengaluru");
    expect(c?.eventUrl).toBe("https://allevents.in/x");
  });

  it("verifies quotes against the source text", () => {
    expect(verifyQuote("CIO   Roundtable", "the cio roundtable is on")).toBe(true);
    expect(verifyQuote("CTO Roundtable", "the cio roundtable is on")).toBe(false);
  });
});
