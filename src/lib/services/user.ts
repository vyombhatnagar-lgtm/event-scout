import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { DEFAULT_PREFERENCES, type Preferences } from "@/types/preferences";

/** Booking link from CALENDLY_URL, used until one is saved in Preferences. Only calendly.com links are accepted. */
function envCalendly(): string | null {
  const u = process.env.CALENDLY_URL?.trim();
  return u && /^https:\/\/(www\.)?calendly\.com\//i.test(u) ? u : null;
}

/**
 * Event Scout is a single user tool for Vikram. The user row is created on first use
 * so a fresh database works without a manual seed step.
 */
export async function getUser() {
  const [existing] = await db().select().from(schema.users).limit(1);
  if (existing) return existing;
  const [created] = await db().insert(schema.users).values({ name: "Vikram" }).returning();
  return created;
}

export async function getPreferences(userId: string): Promise<Preferences & { isDefault: boolean; updatedAt: Date }> {
  const [row] = await db().select().from(schema.userPreferences).where(eq(schema.userPreferences.userId, userId));
  if (row) {
    return {
      categories: row.categories,
      cities: row.cities,
      topics: row.topics,
      formats: row.formats as Preferences["formats"],
      minScore: row.minScore,
      digestEmail: row.digestEmail ?? process.env.DIGEST_RECIPIENT_EMAIL ?? null,
      digestEnabled: row.digestEnabled,
      calendlyUrl: row.calendlyUrl ?? envCalendly(),
      isDefault: row.isDefault,
      updatedAt: row.updatedAt,
    };
  }
  const defaults = { ...DEFAULT_PREFERENCES, digestEmail: process.env.DIGEST_RECIPIENT_EMAIL ?? null, calendlyUrl: envCalendly() };
  await db()
    .insert(schema.userPreferences)
    .values({ userId, ...defaults, isDefault: true })
    .onConflictDoNothing();
  return { ...defaults, isDefault: true, updatedAt: new Date() };
}

export async function savePreferences(userId: string, p: Preferences) {
  const values = { ...p, isDefault: false, updatedAt: new Date() };
  await db()
    .insert(schema.userPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.userPreferences.userId, set: values });
}

/** Bump when the deterministic scoring rules change, so stored scores are recomputed. */
const RULES_VERSION = 2;

/** Scores depend only on these fields; a change invalidates stored scores. */
export function prefsHash(p: Preferences): string {
  const relevant = {
    rules: RULES_VERSION,
    categories: [...p.categories].sort(),
    cities: [...p.cities].sort(),
    topics: [...p.topics].sort(),
    formats: [...p.formats].sort(),
  };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex").slice(0, 16);
}
