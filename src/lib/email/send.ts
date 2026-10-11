import "server-only";
import { Resend } from "resend";

export interface SendResult {
  ok: boolean;
  id: string | null;
  error: string | null;
}

/**
 * Send one email through Resend. `idempotencyKey` makes a retried request with the
 * same key a no-op on Resend's side, so a timeout followed by a retry cannot double-send.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, id: null, error: "RESEND_API_KEY is not set" };
  const from = process.env.DIGEST_FROM_EMAIL || "Event Scout <onboarding@resend.dev>";
  try {
    const { data, error } = await new Resend(key).emails.send(
      { from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text },
      { idempotencyKey: opts.idempotencyKey },
    );
    if (error) return { ok: false, id: null, error: `${error.name}: ${error.message}` };
    return { ok: true, id: data?.id ?? null, error: null };
  } catch (e) {
    return { ok: false, id: null, error: e instanceof Error ? e.message : String(e) };
  }
}
