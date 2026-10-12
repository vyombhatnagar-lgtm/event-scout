import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { AiError } from "@/lib/ai/gemini";
import { CaptureError, captureEvent } from "@/lib/discovery/capture";

export const maxDuration = 120;

const Body = z.object({
  url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), "Link must start with http(s)://"),
  text: z.string().max(20_000).optional().nullable(),
});

/** Add an event from a link and/or pasted announcement text. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const r = await captureEvent(parsed.data);
    return NextResponse.json({ ok: true, ids: r.ids, notes: r.rejected.slice(0, 3) });
  } catch (e) {
    if (e instanceof CaptureError) return NextResponse.json({ error: e.message }, { status: 422 });
    if (e instanceof AiError) return NextResponse.json({ error: `The AI step is unavailable right now (${e.kind === "rate_limit" ? "daily Gemini quota reached" : e.message}). Try again later.` }, { status: 503 });
    return apiError(e, "events/capture");
  }
}
