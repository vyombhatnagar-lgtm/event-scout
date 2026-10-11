import "server-only";
import { z } from "zod";
import { generateStructured } from "./gemini";
import { DEADLINE_HINT, verifyDeadlineEvidence } from "./evidence";

export interface DeadlineInput {
  id: string;
  title: string;
  description: string;
  eventStart: string; // ISO, for year context only
}

const Output = z.object({
  events: z.array(
    z.object({
      id: z.string(),
      deadline: z.string().nullable(),
      evidence: z.string().max(400).nullable(),
    }),
  ),
});

const schema = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          deadline: {
            type: ["string", "null"],
            description: "ISO 8601 date-time with offset (assume +05:30 if the text gives no zone) of the stated registration/application close, else null",
          },
          evidence: { type: ["string", "null"], description: "The exact sentence from the text that states the deadline, copied verbatim; null if none" },
        },
        required: ["id", "deadline", "evidence"],
      },
    },
  },
  required: ["events"],
};

const SYSTEM = `You extract REGISTRATION deadlines from event descriptions.
Return a deadline only when the text explicitly states when registration, applications, RSVPs or ticket sales close.
The event's own start date is NOT a registration deadline — never return it as one.
If the text gives a date without a time, use 23:59 that day. If there is no explicit deadline, return null for both fields.
"evidence" must be copied verbatim from the text.`;

export async function extractDeadlines(batch: DeadlineInput[]) {
  const eligible = batch.filter((b) => DEADLINE_HINT.test(b.description));
  if (eligible.length === 0) return [];
  const out = await generateStructured({
    system: SYSTEM,
    prompt: `Events:\n${JSON.stringify(eligible.map((e) => ({ ...e, description: e.description.slice(0, 3000) })))}`,
    jsonSchema: schema,
    validator: Output,
  });
  const byId = new Map(eligible.map((e) => [e.id, e]));
  return out.events
    .filter((r) => byId.has(r.id))
    .map((r) => {
      const src = byId.get(r.id)!;
      const verified = verifyDeadlineEvidence(r, src.description, new Date(src.eventStart));
      return { id: r.id, ...verified };
    });
}
