import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

type Status = "success" | "partial" | "failed";

/** Records every scheduled/manual job execution so failures are visible on the status page. */
export async function trackJob<T extends { status: Status; detail: Record<string, unknown> }>(
  job: string,
  trigger: string,
  fn: () => Promise<T>,
): Promise<T> {
  const [run] = await db().insert(schema.jobRuns).values({ job, trigger, status: "running" }).returning({ id: schema.jobRuns.id });
  try {
    const result = await fn();
    await db()
      .update(schema.jobRuns)
      .set({ status: result.status, finishedAt: new Date(), detail: result.detail })
      .where(eq(schema.jobRuns.id, run.id));
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db()
      .update(schema.jobRuns)
      .set({ status: "failed", finishedAt: new Date(), detail: { error: message.slice(0, 500) } })
      .where(eq(schema.jobRuns.id, run.id));
    throw e;
  }
}
