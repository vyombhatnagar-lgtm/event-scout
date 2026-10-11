import { NextResponse, connection } from "next/server";
import { apiError } from "@/lib/api";
import { getPreferences, getUser, savePreferences } from "@/lib/services/user";
import { PreferencesSchema } from "@/types/preferences";

export async function GET() {
  await connection();
  try {
    const user = await getUser();
    return NextResponse.json(await getPreferences(user.id));
  } catch (e) {
    return apiError(e, "preferences GET");
  }
}

export async function PUT(req: Request) {
  const parsed = PreferencesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return NextResponse.json({ error: `${i.path.join(".") || "input"}: ${i.message}` }, { status: 400 });
  }
  try {
    const user = await getUser();
    await savePreferences(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "preferences PUT");
  }
}
