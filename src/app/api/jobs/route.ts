import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, badRequest } from "@/lib/api";
import { digestJob, discoveryJob, rescoreJob } from "@/lib/services/workflows";

export const maxDuration = 300;

const Body = z.object({ job: z.enum(["discovery", "scoring", "digest"]) });

/** Manual triggers from the dashboard (signed-in owner only — enforced by proxy). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Unknown job");
  try {
    const r =
      parsed.data.job === "discovery" ? await discoveryJob("manual") : parsed.data.job === "scoring" ? await rescoreJob("manual") : await digestJob("manual");
    return NextResponse.json({ status: r.status, detail: r.detail });
  } catch (e) {
    return apiError(e, `jobs/${parsed.data.job}`);
  }
}
