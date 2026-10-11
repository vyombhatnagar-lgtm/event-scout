import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

export class ConfigError extends Error {}

/** Lazily connects so pages can render a clear "not configured" state instead of crashing at import. */
export function db() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new ConfigError("DATABASE_URL is not set");
  cached = drizzle(neon(url), { schema });
  return cached;
}

export { schema };
