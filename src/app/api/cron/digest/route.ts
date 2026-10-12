import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { isAuthorisedCron } from "@/lib/auth";
import { digestJob } from "@/lib/services/workflows";

export const maxDuration = 300;

/**
 * Vercel Cron: Monday digest. Scheduled twice (06:30 and 08:00 IST); the per week
 * idempotency key means the second run only sends if the first one failed.
 */
export async function GET(req: Request) {
  if (!isAuthorisedCron(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  try {
    const r = await digestJob("cron");
    return NextResponse.json({ status: r.status, detail: r.detail });
  } catch (e) {
    return apiError(e, "cron/digest");
  }
}
