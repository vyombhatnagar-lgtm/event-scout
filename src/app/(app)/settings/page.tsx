import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { renderOrError } from "@/components/shared/load";
import { PageHeader, PageSkeleton } from "@/components/shared/ui";
import { PreferencesForm } from "@/components/settings/preferences-form";
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
    return <PreferencesForm initial={initial} isDefault={p.isDefault} />;
  });
}
