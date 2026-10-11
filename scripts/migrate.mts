/**
 * Applies pending SQL migrations from db/migrations. Runs before every Vercel build,
 * so a fresh Neon database gets its tables without any manual step. Already-applied
 * migrations are skipped (tracked by Drizzle in the drizzle.__drizzle_migrations table).
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL not set — skipping migrations.");
  process.exit(0);
}

await migrate(drizzle(neon(url)), { migrationsFolder: "db/migrations" });
console.log("[migrate] database schema is up to date.");
