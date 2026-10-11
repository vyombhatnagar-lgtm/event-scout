import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { z } from "zod";

/**
 * All application AI runs through Gemini Flash. The model id is configurable so a
 * newer Flash release can be adopted without code changes, but it must be a Flash model.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function geminiModel(): string {
  const m = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!/flash/i.test(m)) throw new Error(`GEMINI_MODEL must be a Gemini Flash model (got "${m}")`);
  return m;
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("GEMINI_API_KEY is not set", "config");
  client = new GoogleGenAI({ apiKey });
  return client;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "rate_limit" | "timeout" | "api" | "invalid_output",
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One structured Gemini call: JSON-schema-constrained output, validated again with Zod.
 * Retries rate limits / transient errors with exponential back-off; never returns unvalidated data.
 */
export async function generateStructured<T>(opts: {
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
  attempts?: number;
  timeoutMs?: number;
}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  let lastErr: AiError | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await ai().models.generateContent({
        model: geminiModel(),
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: opts.jsonSchema,
          temperature: 0,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          httpOptions: { timeout: opts.timeoutMs ?? 45_000 },
        },
      });
      const text = res.text;
      if (!text) throw new AiError("Empty response from Gemini", "invalid_output");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AiError("Gemini returned malformed JSON", "invalid_output");
      }
      const parsed = opts.validator.safeParse(json);
      if (!parsed.success) throw new AiError(`Gemini output failed validation: ${parsed.error.issues[0]?.message}`, "invalid_output");
      return parsed.data;
    } catch (e) {
      lastErr = toAiError(e);
      if (lastErr.kind === "config") throw lastErr;
      if (i < attempts - 1) await sleep((lastErr.kind === "rate_limit" ? 8_000 : 1_500) * 2 ** i);
    }
  }
  throw lastErr ?? new AiError("Gemini call failed", "api");
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new AiError("Gemini rate limit reached", "rate_limit");
    if (e.status === 400 || e.status === 403 || e.status === 404) return new AiError(`Gemini rejected the request (${e.status}): ${e.message.slice(0, 200)}`, "config");
    return new AiError(`Gemini API error ${e.status}`, "api");
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort|timeout/i.test(msg)) return new AiError("Gemini request timed out", "timeout");
  return new AiError(`Gemini call failed: ${msg.slice(0, 200)}`, "api");
}
