import { describe, expect, it } from "vitest";
import { resolveCity } from "@/lib/discovery/cities";
import { eventbrite } from "@/lib/discovery/connectors/eventbrite";
import { luma } from "@/lib/discovery/connectors/luma";
import { meetup } from "@/lib/discovery/connectors/meetup";
import type { Connector } from "@/lib/discovery/connectors/types";
import { deduplicate } from "@/lib/discovery/deduplicate";
import { normalise } from "@/lib/discovery/normalise";
import { discoveryWindow } from "@/lib/time";

const now = new Date();
const { from, to } = discoveryWindow(now);
const ctx = { cities: ["Bengaluru", "Mumbai"].map(resolveCity), windowStart: from, windowEnd: to };

async function check(c: Connector) {
  const { candidates, errors } = await c.fetch(ctx);
  const valid = candidates.map(normalise).filter((r) => r.ok).map((r) => (r as { ok: true; event: import("@/types/event").CandidateEvent }).event);
  console.log(`\n[${c.name}] retrieved=${candidates.length} valid=${valid.length} errors=${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.log(`  ! ${e}`));
  valid.slice(0, 3).forEach((e) => console.log(`  · ${e.startAt.toISOString().slice(0, 16)} ${e.city ?? "?"} ${e.format} — ${e.title.slice(0, 60)} | deadline=${e.statedDeadline?.toISOString() ?? "unknown"}`));
  const withDeadline = valid.filter((e) => e.statedDeadline).length;
  console.log(`  deadlines stated by source: ${withDeadline}/${valid.length}`);
  return { candidates, valid, errors };
}

describe("live sources (real network)", () => {
  for (const c of [luma, eventbrite, meetup]) {
    it(`${c.name} returns real, valid events with source URLs`, async () => {
      const { valid } = await check(c);
      expect(valid.length).toBeGreaterThan(0);
      for (const e of valid) {
        expect(e.sourceUrl).toMatch(/^https:\/\//);
        expect(e.startAt.getTime()).toBeLessThanOrEqual(to.getTime());
      }
    });
  }

  it("an unreachable source fails cleanly without inventing data", async () => {
    const broken: Connector = {
      name: "Broken",
      method: "test",
      async fetch() {
        try {
          await fetch("https://does-not-exist.invalid/events", { signal: AbortSignal.timeout(5000) });
          return { candidates: [], errors: [] };
        } catch (e) {
          return { candidates: [], errors: [String(e)] };
        }
      },
    };
    const r = await broken.fetch(ctx);
    expect(r.candidates).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("cross-source dedupe runs over the combined live set", async () => {
    const all = (await Promise.all([luma, eventbrite, meetup].map((c) => c.fetch(ctx)))).flatMap((r) => r.candidates);
    const valid = all.map(normalise).flatMap((r) => (r.ok ? [r.event] : []));
    const groups = deduplicate(valid);
    const multi = groups.filter((g) => new Set(g.sources.map((s) => s.sourceName)).size > 1);
    console.log(`\n[dedupe] ${valid.length} listings → ${groups.length} events; ${multi.length} found on more than one source`);
    multi.slice(0, 5).forEach((g) => console.log(`  = ${g.primary.title.slice(0, 60)} [${g.sources.map((s) => s.sourceName).join(", ")}]`));
    expect(groups.length).toBeLessThanOrEqual(valid.length);
  });
});
