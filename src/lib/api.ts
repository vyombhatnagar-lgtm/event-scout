import "server-only";
import { NextResponse } from "next/server";
import { ConfigError } from "@/lib/db/client";

/** Uniform JSON error that never leaks internals to the browser; details go to the server log. */
export function apiError(e: unknown, context: string) {
  if (e instanceof ConfigError) {
    return NextResponse.json({ error: "The server is not fully configured yet.", detail: e.message }, { status: 503 });
  }
  console.error(`[${context}]`, e);
  return NextResponse.json({ error: "Something went wrong. It has been logged." }, { status: 500 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
