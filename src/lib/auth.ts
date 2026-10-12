/**
 * Single owner access control. The app is Vikram's private workspace: when APP_PASSWORD
 * is set, every page and API route requires a session cookie obtained by entering it.
 * The cookie value is an HMAC of a fixed label under SESSION_SECRET, so it cannot be
 * forged without the secret and changes whenever the secret is rotated.
 */
export const SESSION_COOKIE = "es_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function authEnabled() {
  return Boolean(process.env.APP_PASSWORD);
}

function secret() {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
}

export async function sessionToken(): Promise<string> {
  return hmac(secret(), `event-scout-session:v1:${process.env.APP_PASSWORD ?? ""}`);
}

/** Constant time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!cookie) return false;
  return safeEqual(cookie, await sessionToken());
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. No secret configured → cron is refused. */
export function isAuthorisedCron(authHeader: string | null): boolean {
  const s = process.env.CRON_SECRET;
  if (!s || !authHeader) return false;
  return safeEqual(authHeader, `Bearer ${s}`);
}
