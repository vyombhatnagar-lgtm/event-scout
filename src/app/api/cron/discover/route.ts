import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { isAuthorisedCron } from "@/lib/auth";
import { discoveryJob } from "@/lib/services/workflows";

export const maxDuration = 300;

/** Vercel Cron: daily discovery + AI enrichment + scoring. */
export async function GET(req: Request) {
  if (!isAuthorisedCron(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const r = await discoveryJob("cron");
    return NextResponse.json({ status: r.status, detail: r.detail });
  } catch (e) {
    return apiError(e, "cron/discover");
  }
}
