/**
 * Time-zone policy: every instant is stored in UTC (timestamptz). Everything the user
 * sees, and every "this week" / "next 30 days" boundary, is computed in APP_TIMEZONE.
 */
export const APP_TIMEZONE = "Asia/Kolkata";
export const DISCOVERY_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

/** Offset of `timeZone` from UTC at instant `d`, in minutes. */
function tzOffsetMinutes(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/** Calendar date (YYYY-MM-DD) of instant `d` in the app time zone. */
export function localDate(d: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The instant at which local midnight of `ymd` occurs in `timeZone`. */
export function zonedMidnight(ymd: string, timeZone = APP_TIMEZONE): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60_000);
}

/** Monday (YYYY-MM-DD, app time zone) of the week containing `now`. */
export function weekStart(now: Date): string {
  const ymd = localDate(now);
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const back = (dow + 6) % 7;
  return new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week before the one containing `now`. */
export function previousWeekStart(now: Date): string {
  const [y, m, d] = weekStart(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10);
}

/** [now, now + 30 days) — the window the dashboard and digest cover. */
export function discoveryWindow(now: Date) {
  return { from: now, to: new Date(now.getTime() + DISCOVERY_WINDOW_DAYS * DAY_MS) };
}

export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: APP_TIMEZONE, ...opts }).format(d);
}

export function formatEventWhen(start: Date, allDay: boolean) {
  const day = formatDate(start, { weekday: "short", day: "numeric", month: "short" });
  if (allDay) return day;
  return `${day} · ${formatDate(start, { hour: "2-digit", minute: "2-digit", hour12: false })} IST`;
}

export { DAY_MS };
