import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";

export { ThinkingLevel };
import type { z } from "zod";

/**
 * All application AI runs through Gemini Flash. GEMINI_MODEL may list several Flash
 * models, comma-separated, in order of preference: when one hits its quota (the free
 * tier allows ~20 requests/day per model) the next is used. Non-Flash ids are rejected.
 */
export const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash"];

export function geminiModels(): string[] {
  const raw = process.env.GEMINI_MODEL?.trim();
  const list = raw ? raw.split(",").map((m) => m.trim()).filter(Boolean) : DEFAULT_GEMINI_MODELS;
  for (const m of list) if (!/flash/i.test(m)) throw new Error(`GEMINI_MODEL must list Gemini Flash models only (got "${m}")`);
  return list;
}

/** Primary model (shown on the status page). */
export function geminiModel(): string {
  return geminiModels()[0];
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
    readonly overloaded = false,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Space calls out to stay under the per-minute limit (free tier: 5 RPM → default 15 s gap = 4 RPM). */
const MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 15_000);
let lastCallAt = 0;
async function pace() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

/** Models that returned 429 in this server instance — skipped until the instance recycles. */
const exhausted = new Set<string>();
/** Model that served the most recent successful call (recorded in job details). */
export let lastModelUsed: string | null = null;

/**
 * One structured Gemini call: JSON-schema-constrained output, validated again with Zod.
 * - 429 → never retried on the same model (that only burns quota); falls through to the next Flash model.
 * - 503 / timeout / invalid output → retried with back-off.
 * Never returns unvalidated data.
 */
export async function generateStructured<T>(opts: {
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  validator: z.ZodType<T>;
  attempts?: number;
  timeoutMs?: number;
  /** MINIMAL for simple labelling tasks (faster), LOW where judgement matters. */
  thinking?: ThinkingLevel;
}): Promise<T> {
  const attempts = opts.attempts ?? 2;
  let lastErr: AiError | null = null;
  for (const model of geminiModels()) {
    if (exhausted.has(model)) continue;
    for (let i = 0; i < attempts; i++) {
      try {
        await pace();
        const res = await ai().models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.system,
            responseMimeType: "application/json",
            responseJsonSchema: opts.jsonSchema,
            temperature: 0,
            thinkingConfig: { thinkingLevel: opts.thinking ?? ThinkingLevel.LOW },
            httpOptions: { timeout: opts.timeoutMs ?? 90_000 },
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
        lastModelUsed = model;
        return parsed.data;
      } catch (e) {
        lastErr = toAiError(e, model);
        if (lastErr.kind === "config") throw lastErr;
        if (lastErr.kind === "rate_limit") {
          exhausted.add(model);
          break; // try the next Flash model
        }
        if (lastErr.overloaded) break; // 503: this model is busy right now — try the next Flash model

        if (i < attempts - 1) await sleep(3_000 * 2 ** i);
      }
    }
  }
  if (lastErr?.kind === "rate_limit" || geminiModels().every((m) => exhausted.has(m))) {
    throw new AiError(`Gemini quota reached for ${geminiModels().join(", ")} — remaining events will be processed on the next run`, "rate_limit");
  }
  throw lastErr ?? new AiError("Gemini call failed", "api");
}

function toAiError(e: unknown, model: string): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new AiError(`Gemini rate limit reached (${model})`, "rate_limit");
    if (e.status === 400 || e.status === 401 || e.status === 403) return new AiError(`Gemini rejected the request (${e.status}): ${e.message.slice(0, 200)}`, "config");
    if (e.status === 404) return new AiError(`Gemini model not found: ${model}`, "api");
    return new AiError(`Gemini API error ${e.status} (${model})`, "api", e.status === 503);
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort|timeout/i.test(msg)) return new AiError("Gemini request timed out", "timeout");
  return new AiError(`Gemini call failed: ${msg.slice(0, 200)}`, "api");
}
