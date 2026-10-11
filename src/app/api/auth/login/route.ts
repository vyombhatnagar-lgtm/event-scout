import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE, authEnabled, safeEqual, sessionToken } from "@/lib/auth";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!authEnabled()) return NextResponse.json({ ok: true });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !safeEqual(parsed.data.password, process.env.APP_PASSWORD!)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
