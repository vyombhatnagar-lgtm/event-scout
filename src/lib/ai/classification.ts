import "server-only";
import { z } from "zod";
import { generateStructured } from "./gemini";

export const EVENT_CATEGORIES = [
  "Conference",
  "CXO summit",
  "Roundtable",
  "Startup ecosystem meetup",
  "Industry forum",
  "Workshop",
  "Networking mixer",
  "Webinar",
  "Investor event",
  "Hackathon",
  "Training / certification",
  "Social / community",
  "Other",
] as const;

export interface ClassifyInput {
  id: string;
  title: string;
  description: string | null;
  organiser: string | null;
  city: string | null;
  format: string;
}

const Output = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      categories: z.array(z.enum(EVENT_CATEGORIES)).min(1).max(3),
      audience: z.string().max(160).nullable(),
      summary: z.string().min(10).max(320),
    }),
  ),
});
export type ClassifyOutput = z.infer<typeof Output>["events"][number];

const schema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          categories: { type: "array", items: { type: "string", enum: [...EVENT_CATEGORIES] }, minItems: 1, maxItems: 3 },
          audience: { type: ["string", "null"], description: "Who the event is for, only if the text says so; otherwise null" },
          summary: { type: "string", description: "Max 2 sentences, factual, from the provided text only" },
        },
        required: ["id", "categories", "audience", "summary"],
      },
    },
  },
  required: ["events"],
};

const SYSTEM = `You classify professional events for a management consultant's business development tool.
Use ONLY the text provided for each event. Do not add facts, speakers, prices, dates or attendance figures that are not in the text.
If the audience is not stated or clearly implied by the text, return null for audience.
Summaries: at most two plain sentences describing what the event is. No hype, no invented detail.
Return one result per input id.`;

/** Classification + summary for a batch of events (user independent, stored on the event). */
export async function classifyEvents(batch: ClassifyInput[]): Promise<ClassifyOutput[]> {
  if (batch.length === 0) return [];
  const prompt = JSON.stringify(
    batch.map((e) => ({ ...e, description: e.description?.slice(0, 1500) ?? null })),
  );
  const out = await generateStructured({ system: SYSTEM, prompt: `Events:\n${prompt}`, jsonSchema: schema, validator: Output });
  const ids = new Set(batch.map((b) => b.id));
  return out.events.filter((e) => ids.has(e.id));
}
