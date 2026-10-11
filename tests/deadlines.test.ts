import { describe, expect, it } from "vitest";
import { deadlineState, resolveDeadline } from "@/lib/deadlines";
import { localDate, weekStart, zonedMidnight } from "@/lib/time";

const DAY = 86_400_000;
const now = new Date("2026-10-12T03:30:00.000Z"); // Mon 12 Oct 2026, 09:00 IST

describe("deadline urgency (7-day rule)", () => {
  it("exactly 7 days away is NOT urgent", () => {
    expect(deadlineState(new Date(now.getTime() + 7 * DAY), now).kind).toBe("open");
  });
  it("one second under 7 days IS urgent", () => {
    expect(deadlineState(new Date(now.getTime() + 7 * DAY - 1000), now).kind).toBe("urgent");
  });
  it("6 days away is urgent and says 6 days", () => {
    const s = deadlineState(new Date(now.getTime() + 6 * DAY), now);
    expect(s.kind).toBe("urgent");
    expect(s.label).toBe("Closes in 6 days");
  });
  it("tomorrow is urgent", () => {
    const s = deadlineState(new Date(now.getTime() + DAY), now);
    expect(s.kind).toBe("urgent");
    expect(s.label).toBe("Closes in 1 day");
  });
  it("under a day shows hours", () => {
    expect(deadlineState(new Date(now.getTime() + 5 * 3_600_000), now).label).toBe("Closes in 5h");
  });
  it("already passed is closed, never open", () => {
    expect(deadlineState(new Date(now.getTime() - 1000), now).kind).toBe("closed");
    expect(deadlineState(now, now).kind).toBe("closed");
  });
  it("missing deadline is 'Deadline unknown' — never inferred", () => {
    expect(deadlineState(null, now)).toEqual({ kind: "unknown", label: "Deadline unknown" });
  });
});

describe("conflicting source deadlines", () => {
  it("keeps the earliest and flags the conflict", () => {
    const a = new Date("2026-10-15T18:29:00Z");
    const b = new Date("2026-10-17T18:29:00Z");
    const r = resolveDeadline([
      { source: "Luma", deadline: b },
      { source: "Eventbrite", deadline: a },
    ]);
    expect(r.deadline?.toISOString()).toBe(a.toISOString());
    expect(r.conflict).toBe(true);
  });
  it("agreeing sources are not a conflict", () => {
    const a = new Date("2026-10-15T18:29:00Z");
    expect(resolveDeadline([{ source: "x", deadline: a }, { source: "y", deadline: new Date(a) }]).conflict).toBe(false);
  });
  it("sources that state nothing are ignored", () => {
    expect(resolveDeadline([{ source: "x", deadline: null }])).toEqual({ deadline: null, conflict: false });
  });
});

describe("time-zone policy (IST)", () => {
  it("local date uses IST, not UTC", () => {
    // 20:00 UTC on the 11th is 01:30 IST on the 12th
    expect(localDate(new Date("2026-10-11T20:00:00Z"))).toBe("2026-10-12");
  });
  it("IST midnight is 18:30 UTC the previous day", () => {
    expect(zonedMidnight("2026-10-23").toISOString()).toBe("2026-10-22T18:30:00.000Z");
  });
  it("week starts on Monday in IST", () => {
    expect(weekStart(new Date("2026-10-11T20:00:00Z"))).toBe("2026-10-12"); // already Monday in IST
    expect(weekStart(new Date("2026-10-11T12:00:00Z"))).toBe("2026-10-05"); // still Sunday in IST
    expect(weekStart(new Date("2026-10-18T10:00:00Z"))).toBe("2026-10-12");
  });
});
