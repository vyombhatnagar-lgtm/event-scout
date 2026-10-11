import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, badRequest } from "@/lib/api";
import { setTaskDone } from "@/lib/services/checklist";
import { getUser } from "@/lib/services/user";

const Body = z.object({ done: z.boolean() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/checklist/[id]">) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return badRequest("Invalid task id");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid body");
  try {
    const user = await getUser();
    const ok = await setTaskDone(user.id, id, parsed.data.done);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Task not found" }, { status: 404 });
  } catch (e) {
    return apiError(e, "checklist PATCH");
  }
}
