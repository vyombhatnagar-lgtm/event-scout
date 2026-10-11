import { describe, expect, it } from "vitest";
import { canonicalCity, cityMatches } from "@/lib/discovery/cities";
import { extractLdEvents } from "@/lib/discovery/connectors/jsonld";
import { lumaDeadline, proseToText } from "@/lib/discovery/connectors/luma";
import { deduplicate } from "@/lib/discovery/deduplicate";
import { cleanText, dedupeKey, normalise } from "@/lib/discovery/normalise";
import type { CandidateEvent, CandidateEventInput } from "@/types/event";

const base = (over: Partial<CandidateEventInput> = {}): CandidateEventInput => ({
  sourceName: "Eventbrite",
  sourceEventId: "1",
  sourceUrl: "https://www.eventbrite.com/e/x-tickets-1",
  title: "CXO Roundtable: Operations Strategy",
  startAt: new Date("2026-10-23T12:30:00Z"),
  eventUrl: "https://www.eventbrite.com/e/x-tickets-1",
  city: "Bengaluru",
  format: "in_person",
  ...over,
});
const ok = (r: ReturnType<typeof normalise>) => {
  if (!r.ok) throw new Error(r.reason);
  return r.event;
};

describe("normalisation", () => {
  it("accepts a valid record and keeps unknowns null", () => {
    const e = ok(normalise(base()));
    expect(e.registrationUrl).toBeNull();
    expect(e.statedDeadline).toBeNull();
    expect(e.priceText).toBeNull();
    expect(e.organiser).toBeNull();
  });
  it("rejects a record with no usable title", () => {
    expect(normalise(base({ title: "  " })).ok).toBe(false);
  });
  it("rejects non-http URLs", () => {
    expect(normalise(base({ eventUrl: "javascript:alert(1)" })).ok).toBe(false);
  });
  it("rejects an end before the start", () => {
    expect(normalise(base({ endAt: new Date("2026-10-22T00:00:00Z") })).ok).toBe(false);
  });
  it("strips HTML and decodes entities", () => {
    expect(cleanText("<b>Founders &amp; CXOs</b>&nbsp;meet")).toBe("Founders & CXOs meet");
  });
});

describe("duplicate detection", () => {
  const ev = (over: Partial<CandidateEventInput>) => ok(normalise(base(over)));

  it("merges the same event listed on two sites (same title, date, city)", () => {
    const groups = deduplicate([
      ev({}),
      ev({ sourceName: "Meetup", sourceEventId: "99", sourceUrl: "https://www.meetup.com/g/events/99/", eventUrl: "https://www.meetup.com/g/events/99/", title: "CXO Roundtable – Operations Strategy!" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].sources.map((s) => s.sourceName).sort()).toEqual(["Eventbrite", "Meetup"]);
  });
  it("does NOT merge similar titles on different dates", () => {
    const groups = deduplicate([ev({}), ev({ sourceEventId: "2", eventUrl: "https://www.eventbrite.com/e/y-tickets-2", sourceUrl: "https://www.eventbrite.com/e/y-tickets-2", startAt: new Date("2026-10-30T12:30:00Z") })]);
    expect(groups).toHaveLength(2);
  });
  it("does NOT merge the same title in different cities", () => {
    const groups = deduplicate([ev({}), ev({ sourceEventId: "3", eventUrl: "https://www.eventbrite.com/e/z-tickets-3", sourceUrl: "https://www.eventbrite.com/e/z-tickets-3", city: "Mumbai" })]);
    expect(groups).toHaveLength(2);
  });
  it("merges repeated listings with the same source id", () => {
    expect(deduplicate([ev({}), ev({})])).toHaveLength(1);
  });
  it("merges same canonical URL even if titles differ", () => {
    expect(deduplicate([ev({}), ev({ sourceName: "Luma", sourceEventId: "evt-1", title: "Totally different name" })])).toHaveLength(1);
  });
  it("dedupe key uses the IST calendar date", () => {
    const k = dedupeKey({ title: "Demo Day", startAt: new Date("2026-10-22T19:00:00Z"), city: "Mumbai", format: "in_person" } as CandidateEvent);
    expect(k).toBe("demo day|2026-10-23|mumbai");
  });
});

describe("cities", () => {
  it("maps Bangalore to Bengaluru", () => {
    expect(canonicalCity("Bangalore")).toBe("Bengaluru");
    expect(cityMatches("bangalore", ["Bengaluru"])).toBe(true);
  });
  it("does not match other cities", () => {
    expect(cityMatches("Pune", ["Bengaluru", "Mumbai"])).toBe(false);
    expect(cityMatches(null, ["Bengaluru"])).toBe(false);
  });
});

describe("schema.org extraction", () => {
  it("finds events inside an ItemList and ignores malformed blocks", () => {
    const html = `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Event","name":"A","startDate":"2026-10-20","url":"https://x.test/a"}}]}</script>
      <script type="application/ld+json">{not json</script>
      <script type="application/ld+json">[{"@type":"Organization","name":"Org"},{"@type":"BusinessEvent","name":"B","startDate":"2026-10-21T10:00:00Z","url":"https://x.test/b"}]</script>`;
    expect(extractLdEvents(html).map((e) => e.name)).toEqual(["A", "B"]);
  });
});

describe("Luma parsing", () => {
  it("deadline = latest end-of-sale only when every visible ticket type states one", () => {
    expect(lumaDeadline({ ticket_types: [{ valid_end_at: "2026-10-14T18:29:00Z" }, { valid_end_at: "2026-10-16T18:29:00Z" }] })?.toISOString()).toBe("2026-10-16T18:29:00.000Z");
    expect(lumaDeadline({ ticket_types: [{ valid_end_at: "2026-10-14T18:29:00Z" }, { valid_end_at: null }] })).toBeNull();
    expect(lumaDeadline({ ticket_types: [{ valid_end_at: "2026-10-14T18:29:00Z" }, { valid_end_at: null, is_hidden: true }] })?.toISOString()).toBe("2026-10-14T18:29:00.000Z");
    expect(lumaDeadline(null)).toBeNull();
  });
  it("flattens ProseMirror descriptions", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "founders" }] }, { type: "paragraph", content: [{ type: "text", text: "RSVP by Oct 20." }] }] };
    expect(proseToText(doc).trim()).toBe("Hello founders\nRSVP by Oct 20.");
  });
});
