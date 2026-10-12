import { describe, expect, it } from "vitest";
import { carryOver } from "@/lib/checklist/carryover";
import { deadlineState } from "@/lib/deadlines";
import type { EventView } from "@/lib/services/events";

const now = new Date("2026-10-19T04:00:00Z"); // Mon 19 Oct 2026, 09:30 IST
const thisWeek = "2026-10-19";
const lastWeekDay = new Date("2026-10-14T06:00:00Z"); // touched last Wednesday
const thisWeekDay = new Date("2026-10-19T03:00:00Z"); // touched this Monday

function ev(id: string, over: Partial<EventView> = {}): EventView {
  const deadline = over.deadline ?? null;
  return {
    id,
    title: `Event ${id}`,
    summary: null,
    description: null,
    startAt: new Date("2026-10-24T12:30:00Z"),
    endAt: null,
    allDay: false,
    venue: null,
    city: "Bengaluru",
    country: "IN",
    format: "in_person",
    categories: [],
    audience: null,
    organiser: null,
    eventUrl: "https://x.test",
    registrationUrl: null,
    registrationOpen: null,
    deadline,
    deadlineOrigin: null,
    deadlineEvidence: null,
    deadlineConflict: false,
    deadlineState: deadlineState(deadline, now),
    priceText: null,
    imageUrl: null,
    aiStatus: "done",
    score: 80,
    aiScore: 80,
    ruleScore: 80,
    reason: null,
    status: "saved",
    statusUpdatedAt: lastWeekDay,
    sources: [],
    lastVerifiedAt: now,
    ...over,
  };
}
const task = (id: string, kind: string, eventId: string | null, done = false) => ({ id, kind, eventId, label: id, detail: null, done });

describe("carry-over from last week", () => {
  it("keeps unticked, still-relevant actions", () => {
    const r = carryOver([task("t1", "register", "a")], [], [ev("a", { status: "to_register" })], thisWeek, now);
    expect(r.tasks.map((t) => t.id)).toEqual(["t1"]);
  });
  it("drops done actions, past events, closed registrations and ones already on this week's list", () => {
    const pipeline = [
      ev("past", { startAt: new Date("2026-10-17T12:00:00Z") }),
      ev("closed", { deadline: new Date("2026-10-18T12:00:00Z") }),
      ev("dup", { status: "to_register" }),
      ev("reg", { status: "registered" }),
    ];
    const r = carryOver(
      [task("done", "review", "dup", true), task("p", "review", "past"), task("c", "register", "closed"), task("d", "register", "dup"), task("r", "register", "reg")],
      [task("now", "register", "dup")],
      pipeline,
      thisWeek,
      now,
    );
    expect(r.tasks).toHaveLength(0);
  });
  it("lists events parked before this week that are still undecided", () => {
    const r = carryOver([], [], [ev("s"), ev("tr", { status: "to_register" }), ev("fresh", { statusUpdatedAt: thisWeekDay })], thisWeek, now);
    expect(r.events.map((e) => e.event.id)).toEqual(["s", "tr"]);
    expect(r.events[1].reason).toMatch(/not finished/);
  });
  it("reminds about follow-ups for events attended before this week", () => {
    const r = carryOver([], [], [ev("att", { status: "attended", startAt: new Date("2026-10-15T12:00:00Z") })], thisWeek, now);
    expect(r.events[0].reason).toMatch(/follow up/);
  });
  it("never lists dismissed or registered events", () => {
    const r = carryOver([], [], [ev("x", { status: "dismissed" }), ev("y", { status: "registered" })], thisWeek, now);
    expect(r.events).toHaveLength(0);
  });
  it("carries your own unfinished tasks, but not meetings or weekly routines", () => {
    const r = carryOver([task("own", "task", null), task("m", "meeting", null), task("r", "routine_plan", null)], [], [], thisWeek, now);
    expect(r.tasks.map((t) => t.id)).toEqual(["own"]);
  });
});
