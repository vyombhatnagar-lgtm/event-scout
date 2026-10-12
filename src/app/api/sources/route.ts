import { NextResponse, connection } from "next/server";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { db, schema } from "@/lib/db/client";

const Body = z.object({
  label: z.string().trim().min(2).max(60),
  url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), "Link must start with http(s)://"),
});

export async function GET() {
  await connection();
  try {
    return NextResponse.json(await db().select().from(schema.customSources).orderBy(asc(schema.customSources.createdAt)));
  } catch (e) {
    return apiError(e, "sources GET");
  }
}

/** Add a conference site, iSPIRT page, newsletter feed or iCal feed. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const [row] = await db().insert(schema.customSources).values(parsed.data).onConflictDoNothing().returning();
    if (!row) return NextResponse.json({ error: "That link is already a source" }, { status: 409 });
    return NextResponse.json(row);
  } catch (e) {
    return apiError(e, "sources POST");
  }
}
