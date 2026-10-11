import "server-only";
import { z } from "zod";
import type { Preferences } from "@/types/preferences";
import { generateStructured } from "./gemini";

export interface RankInput {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  categories: string[];
  audience: string | null;
  organiser: string | null;
  city: string | null;
  format: string;
  start: string;
}

const Output = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      score: z.number().int().min(0).max(100),
      reason: z.string().min(10).max(260),
    }),
  ),
});
export type RankOutput = z.infer<typeof Output>["events"][number];

const schema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string", description: "One sentence citing specific facts from the event text that drive the score" },
        },
        required: ["id", "score", "reason"],
      },
    },
  },
  required: ["events"],
};

const SYSTEM = `You score events for business-development value to an independent management consultant who wins clients by meeting senior decision-makers in person.
Score 0–100 for how likely attending leads to meeting potential clients that match his profile:
- 80–100: senior business audience (founders, CXOs, investors, leaders) AND strong topic match.
- 50–79: relevant topic or relevant audience, not both.
- 20–49: tangential (mostly technical practitioners, students, generic networking).
- 0–19: unrelated (consumer, entertainment, hobby, unrelated industry).
Judge ONLY from the given fields. Do not assume speakers, sponsors or attendance that are not stated.
The reason must cite concrete facts from the event fields (topic, audience, organiser, format) — never invent any.
Location and format preferences are applied separately by rules; focus on audience and topic fit.`;

/** Gemini relevance assessment for one batch against the user's stored preferences. */
export async function assessRelevance(batch: RankInput[], prefs: Preferences): Promise<RankOutput[]> {
  if (batch.length === 0) return [];
  const profile = {
    categories: prefs.categories,
    topics: prefs.topics,
    target_cities: prefs.cities,
  };
  const events = batch.map((e) => ({ ...e, description: e.description?.slice(0, 1200) ?? null }));
  const out = await generateStructured({
    system: SYSTEM,
    prompt: `Consultant profile:\n${JSON.stringify(profile)}\n\nEvents:\n${JSON.stringify(events)}`,
    jsonSchema: schema,
    validator: Output,
  });
  const ids = new Set(batch.map((b) => b.id));
  return out.events.filter((e) => ids.has(e.id));
}
