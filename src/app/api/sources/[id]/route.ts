import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, badRequest } from "@/lib/api";
import { db, schema } from "@/lib/db/client";

const Id = z.string().uuid();

export async function PATCH(req: Request, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  if (!Id.safeParse(id).success) return badRequest("Invalid source id");
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid body");
  try {
    const rows = await db().update(schema.customSources).set({ enabled: parsed.data.enabled }).where(eq(schema.customSources.id, id)).returning({ id: schema.customSources.id });
    return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return apiError(e, "sources PATCH");
  }
}

/** Removes the source. Events already found from it stay (they keep their source link). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  if (!Id.safeParse(id).success) return badRequest("Invalid source id");
  try {
    const rows = await db().delete(schema.customSources).where(eq(schema.customSources.id, id)).returning({ id: schema.customSources.id });
    return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return apiError(e, "sources DELETE");
  }
}
