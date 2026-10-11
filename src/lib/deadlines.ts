import { DAY_MS } from "./time";

export const URGENT_WINDOW_DAYS = 7;

export type DeadlineState =
  | { kind: "unknown"; label: "Deadline unknown" }
  | { kind: "closed"; label: string }
  | { kind: "urgent"; label: string; msLeft: number; daysLeft: number }
  | { kind: "open"; label: string; msLeft: number; daysLeft: number };

/**
 * Urgency policy:
 * - no stated deadline → "unknown" (never inferred from the event date)
 * - deadline <= now → "closed"
 * - 0 < time left < exactly 7 × 24 h → "urgent"
 * - time left >= 7 × 24 h → "open"
 */
export function deadlineState(deadline: Date | null | undefined, now: Date): DeadlineState {
  if (!deadline) return { kind: "unknown", label: "Deadline unknown" };
  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft <= 0) return { kind: "closed", label: "Registration deadline passed" };
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  if (msLeft < URGENT_WINDOW_DAYS * DAY_MS) {
    const label =
      msLeft < DAY_MS
        ? `Closes in ${Math.max(1, Math.ceil(msLeft / 3_600_000))}h`
        : `Closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    return { kind: "urgent", label, msLeft, daysLeft };
  }
  return { kind: "open", label: `Closes in ${daysLeft} days`, msLeft, daysLeft };
}

export interface StatedDeadline {
  source: string;
  deadline: Date | null;
}

/**
 * Combine deadlines stated by several sources for the same event.
 * Sources that state nothing are ignored. When stated values disagree we keep the
 * EARLIEST (so the user is never told they have more time than one source says)
 * and flag the conflict for display.
 */
export function resolveDeadline(stated: StatedDeadline[]): { deadline: Date | null; conflict: boolean } {
  const known = stated.map((s) => s.deadline).filter((d): d is Date => d instanceof Date);
  if (known.length === 0) return { deadline: null, conflict: false };
  const times = [...new Set(known.map((d) => d.getTime()))].sort((a, b) => a - b);
  return { deadline: new Date(times[0]), conflict: times.length > 1 };
}
