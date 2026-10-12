import type { CandidateEventInput } from "@/types/event";
import type { CityRef } from "../cities";

export interface ConnectorContext {
  cities: CityRef[];
  windowStart: Date;
  windowEnd: Date;
  /** The user's focus areas, for sources that search (web search). */
  focus?: { categories: string[]; topics: string[] };
}

export interface ConnectorResult {
  candidates: CandidateEventInput[];
  /** Non-fatal problems (one city failed, one page malformed…). Recorded in source_runs. */
  errors: string[];
}

export interface Connector {
  name: string;
  /** Human description of how data is obtained — shown on the status page. */
  method: string;
  fetch(ctx: ConnectorContext): Promise<ConnectorResult>;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36 EventScout/1.0";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with a timeout; a 429 is retried once after the server's Retry-After (max 15 s). */
export async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(15, Number(res.headers.get("retry-after")) || 6) * 1000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  return JSON.parse(await fetchText(url, timeoutMs)) as T;
}

/** Run `fn` over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
