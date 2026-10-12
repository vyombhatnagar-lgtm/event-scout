import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { renderOrError } from "@/components/shared/load";
import { PageHeader, PageSkeleton } from "@/components/shared/ui";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SourcesManager } from "@/components/settings/sources-manager";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getPreferences, getUser } from "@/lib/services/user";

export const metadata: Metadata = { title: "Preferences" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Preferences" sub="Stored in the database. Changes apply to ranking immediately and to the next discovery run — no redeploy." />
      <Suspense fallback={<PageSkeleton />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await connection();
  return renderOrError(async () => {
    const user = await getUser();
    const p = await getPreferences(user.id);
    const initial = { categories: p.categories, cities: p.cities, topics: p.topics, formats: p.formats, minScore: p.minScore, digestEmail: p.digestEmail, digestEnabled: p.digestEnabled, calendlyUrl: p.calendlyUrl };
    const sources = await db().select().from(schema.customSources).orderBy(asc(schema.customSources.createdAt));
    return (
      <>
        <PreferencesForm initial={initial} isDefault={p.isDefault} />
        <SourcesManager
          initial={sources.map((s) => ({ ...s, lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null }))}
        />
      </>
    );
  });
}
