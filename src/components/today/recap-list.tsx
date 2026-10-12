import Link from "next/link";
import type { Pointer } from "@/lib/checklist/recap-pointers";

/** Tick list of last week's status: green tick when clear, orange dot when something needs attention. */
export function RecapList({ pointers }: { pointers: Pointer[] }) {
  return (
    <ul className="flex flex-col gap-2.5 py-1">
      {pointers.map((p) => (
        <li key={p.text} className="flex items-start gap-2.5 text-sm">
          {p.clear ? (
            <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full bg-ok-soft" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3.5" strokeLinecap="round">
                <path d="M6 12l4 4 8-8" />
              </svg>
            </span>
          ) : (
            <span className="mt-1 size-2.5 shrink-0 rounded-full bg-urgent" aria-hidden="true" />
          )}
          {p.href ? (
            <Link href={p.href} className={`no-underline hover:underline ${p.clear ? "text-ink-2" : "font-medium text-ink"}`}>
              {p.text}
            </Link>
          ) : (
            <span className="text-ink-2">{p.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
