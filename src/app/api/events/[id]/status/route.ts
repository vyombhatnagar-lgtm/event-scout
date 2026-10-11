import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, badRequest } from "@/lib/api";
import { pipelineStatus } from "@/lib/db/schema";
import { eventExists, setPipelineStatus } from "@/lib/services/events";
import { getUser } from "@/lib/services/user";

const Body = z.object({ status: z.enum(pipelineStatus.enumValues) });

export async function PUT(req: Request, ctx: RouteContext<"/api/events/[id]/status">) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return badRequest("Invalid event id");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid status");
  try {
    if (!(await eventExists(id))) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const user = await getUser();
    await setPipelineStatus(user.id, id, parsed.data.status);
    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (e) {
    return apiError(e, "events/status");
  }
}
