import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { addTask } from "@/lib/services/checklist";
import { getUser } from "@/lib/services/user";

const Body = z.object({
  kind: z.enum(["task", "meeting"]),
  label: z.string().trim().min(2).max(160),
  detail: z.string().trim().max(300).optional().nullable(),
  dueAt: z.string().datetime({ offset: true }),
  eventId: z.string().uuid().optional().nullable(),
});

/** Add one of Vikram's own tasks or work meetings. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  try {
    const user = await getUser();
    const row = await addTask(user.id, { ...parsed.data, detail: parsed.data.detail || null, dueAt: new Date(parsed.data.dueAt) });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return apiError(e, "checklist POST");
  }
}
