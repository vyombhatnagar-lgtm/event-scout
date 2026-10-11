import { describe, expect, it } from "vitest";
import { DEADLINE_HINT, verifyDeadlineEvidence } from "@/lib/ai/evidence";
import { HARD_MISMATCH_CAP, finalScore, ruleScore, topicMatches } from "@/lib/ranking/rules";
import { DEFAULT_PREFERENCES, PreferencesSchema, type Preferences } from "@/types/preferences";

const now = new Date("2026-10-12T03:30:00Z");
const prefs: Preferences = { ...DEFAULT_PREFERENCES };

const relevant = {
  title: "CXO Roundtable: Digital Transformation in Financial Services",
  description: "An invite-only evening for CIOs and founders on digital transformation strategy and leadership.",
  city: "Bengaluru",
  format: "in_person" as const,
  categories: ["Roundtable"],
  startAt: new Date("2026-10-20T12:30:00Z"),
};
const irrelevant = {
  title: "Sunday Pottery Workshop for Beginners",
  description: "Learn to throw clay pots. All materials provided.",
  city: "Bengaluru",
  format: "in_person" as const,
  categories: ["Workshop"],
  startAt: new Date("2026-10-20T12:30:00Z"),
};

describe("deterministic relevance rules", () => {
  it("ranks a relevant business event above an irrelevant one", () => {
    expect(ruleScore(relevant, prefs, now).total).toBeGreaterThan(ruleScore(irrelevant, prefs, now).total);
  });
  it("is deterministic", () => {
    expect(ruleScore(relevant, prefs, now)).toEqual(ruleScore(relevant, prefs, now));
  });
  it("topic matching needs every significant word", () => {
    expect(topicMatches("Digital transformation", "digital transformation summit")).toBe(true);
    expect(topicMatches("Digital transformation", "digital marketing")).toBe(false);
    expect(topicMatches("Venture capital", "Meet venture capitalists")).toBe(true);
  });
});

describe("preferences change results", () => {
  it("changing target city changes the score", () => {
    const inCity = finalScore(ruleScore(relevant, prefs, now), 90, relevant, prefs);
    const moved = { ...prefs, cities: ["Pune"] };
    const outCity = finalScore(ruleScore(relevant, moved, now), 90, relevant, moved);
    expect(inCity).toBeGreaterThan(outCity);
    expect(outCity).toBeLessThanOrEqual(HARD_MISMATCH_CAP);
  });
  it("changing categories/topics changes the score", () => {
    const narrow = { ...prefs, topics: ["Pottery"], categories: ["Workshops"] };
    expect(ruleScore(irrelevant, narrow, now).total).toBeGreaterThan(ruleScore(irrelevant, prefs, now).total);
  });
  it("AI cannot lift an unwanted online event above the cap", () => {
    const online = { ...relevant, format: "online" as const, city: null };
    expect(finalScore(ruleScore(online, prefs, now), 100, online, prefs)).toBeLessThanOrEqual(HARD_MISMATCH_CAP);
    const wantsOnline = { ...prefs, formats: [...prefs.formats, "online" as const] };
    expect(finalScore(ruleScore(online, wantsOnline, now), 100, online, wantsOnline)).toBeGreaterThan(HARD_MISMATCH_CAP);
  });
  it("without an AI score the rule score is used as-is", () => {
    const r = ruleScore(relevant, prefs, now);
    expect(finalScore(r, null, relevant, prefs)).toBe(r.total);
  });
});

describe("AI deadline evidence guard", () => {
  const text = "Join founders for an evening of talks. Registrations close on 18 October 2026 at 6 PM. Venue: Indiranagar.";
  const start = new Date("2026-10-23T12:30:00Z");
  it("accepts a deadline whose quote is in the text", () => {
    const r = verifyDeadlineEvidence({ deadline: "2026-10-18T18:00:00+05:30", evidence: "Registrations close on 18 October 2026 at 6 PM." }, text, start);
    expect(r.deadline?.toISOString()).toBe("2026-10-18T12:30:00.000Z");
  });
  it("rejects a hallucinated quote", () => {
    const r = verifyDeadlineEvidence({ deadline: "2026-10-18T18:00:00+05:30", evidence: "Registration closes 18 Oct." }, text, start);
    expect(r.deadline).toBeNull();
    expect(r.rejected).toMatch(/not found/);
  });
  it("rejects a 'deadline' after the event starts", () => {
    const r = verifyDeadlineEvidence({ deadline: "2026-10-25T18:00:00+05:30", evidence: "Registrations close on 18 October 2026 at 6 PM." }, text, start);
    expect(r.deadline).toBeNull();
  });
  it("only calls the AI when the text could contain a deadline", () => {
    expect(DEADLINE_HINT.test(text)).toBe(true);
    expect(DEADLINE_HINT.test("Last date to register: 20 Oct")).toBe(true);
    expect(DEADLINE_HINT.test("RSVP before Friday")).toBe(true);
    expect(DEADLINE_HINT.test("A fun evening of networking in Koramangala.")).toBe(false);
  });
});

describe("preference validation", () => {
  it("requires at least one city", () => {
    expect(PreferencesSchema.safeParse({ ...prefs, cities: [], digestEmail: "", calendlyUrl: "" }).success).toBe(false);
  });
  it("rejects non-Calendly booking links", () => {
    expect(PreferencesSchema.safeParse({ ...prefs, digestEmail: "", calendlyUrl: "https://evil.example.com" }).success).toBe(false);
  });
  it("accepts the defaults", () => {
    expect(PreferencesSchema.safeParse({ ...prefs, digestEmail: "", calendlyUrl: "" }).success).toBe(true);
  });
});
