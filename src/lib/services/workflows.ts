import "server-only";
import { emptyAiReport, enrichPending, scoreForUser } from "@/lib/ai/process";
import { sendDigest } from "@/lib/digest/service";
import { runDiscovery } from "@/lib/discovery/pipeline";
import { syncWeeklyTasks } from "./checklist";
import { trackJob } from "./jobs";
import { getPreferences, getUser } from "./user";

/** Leave headroom under the function's maxDuration (300 s on Vercel). */
const AI_BUDGET_MS = 200_000;

/** Daily job: discover → enrich with Gemini → score for the user → refresh checklist. */
export function discoveryJob(trigger: "cron" | "manual") {
  return trackJob("discovery", trigger, async () => {
    const started = Date.now();
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const discovery = await runDiscovery(prefs.cities);
    const ai = emptyAiReport();
    const budgetEnds = started + AI_BUDGET_MS;
    await enrichPending(ai, budgetEnds);
    await scoreForUser(user.id, prefs, ai, budgetEnds);
    await syncWeeklyTasks(user.id, prefs);
    const failedSources = discovery.sources.filter((s) => s.status === "failed").length;
    const status: "success" | "partial" | "failed" =
      failedSources === discovery.sources.length ? "failed" : failedSources > 0 || ai.errors.length > 0 || ai.stoppedEarly ? "partial" : "success";
    return { status, detail: { discovery, ai, ms: Date.now() - started } };
  });
}

/** Re-score only (used after preferences change, and before the digest). */
export function rescoreJob(trigger: "manual" | "preferences" | "cron") {
  return trackJob("scoring", trigger, async () => {
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const ai = emptyAiReport();
    const budgetEnds = Date.now() + AI_BUDGET_MS;
    await enrichPending(ai, budgetEnds);
    await scoreForUser(user.id, prefs, ai, budgetEnds);
    await syncWeeklyTasks(user.id, prefs);
    return { status: ai.errors.length || ai.stoppedEarly ? ("partial" as const) : ("success" as const), detail: { ai } };
  });
}

/** Monday job: top up scores, then send the digest once for the week. */
export function digestJob(trigger: "cron" | "manual") {
  return trackJob("digest", trigger, async () => {
    const user = await getUser();
    const prefs = await getPreferences(user.id);
    const ai = emptyAiReport();
    await scoreForUser(user.id, prefs, ai, Date.now() + 90_000);
    const outcome = await sendDigest(trigger === "cron" ? "scheduled" : "manual");
    const status = outcome.outcome === "failed" ? ("failed" as const) : ("success" as const);
    return { status, detail: { outcome, ai } };
  });
}
