import type { ReactNode } from "react";
import { ConfigError } from "@/lib/db/client";
import { Card } from "./ui";

/** Render time data loading with honest failure states (never a blank page, never fake data). */
export async function renderOrError(fn: () => Promise<ReactNode>): Promise<ReactNode> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ConfigError) {
      return (
        <Card className="p-6">
          <h2 className="font-semibold">Database not configured</h2>
          <p className="mt-2 text-sm text-ink-2">
            Set <code className="font-mono">DATABASE_URL</code> to your Neon connection string, run the migrations, then reload. See the README.
          </p>
        </Card>
      );
    }
    console.error("[page load]", e);
    return (
      <Card className="p-6">
        <h2 className="font-semibold text-urgent">Could not load this page</h2>
        <p className="mt-2 text-sm text-ink-2">The database or a service did not respond. The error has been logged on the server, reload to try again.</p>
      </Card>
    );
  }
}
