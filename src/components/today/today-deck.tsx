"use client";
/* eslint-disable @next/next/no-img-element -- remote cover images from many event hosts */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface DeckItem {
  id: string;
  title: string;
  when: string;
  where: string;
  why: string | null;
  fit: number | null;
  rulesOnly: boolean;
  category: string;
  hue: { tint: string; shape: string; ink: string };
  image: string | null;
  day: string; // YYYY-MM-DD (IST)
  daysLeft: number | null;
  deadlineTitle: string;
  deadlineSub: string;
  registrationUrl: string | null;
  gcalUrl: string;
  icsUrl: string;
  source: string;
}

export interface DayCell {
  key: string;
  dow: string;
  num: number;
  dots: string[];
  isToday: boolean;
}

type Status = "dismissed" | "saved" | "to_register" | "registered";

async function setStatus(id: string, status: Status) {
  const res = await fetch(`/api/events/${id}/status`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error("Could not save your choice — check your connection and try again.");
}

function Ring({ daysLeft }: { daysLeft: number | null }) {
  const known = daysLeft != null;
  const color = !known ? "#8A8E83" : daysLeft! <= 2 ? "#C2410C" : "#B7791F";
  const frac = known ? Math.max(0.06, (7 - Math.min(daysLeft!, 7)) / 7) : 0;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
      <circle cx="18" cy="18" r="15" fill="none" stroke="#E7E3DA" strokeWidth="4" />
      {known && <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${Math.round(frac * 94)} 100`} transform="rotate(-90 18 18)" />}
    </svg>
  );
}

/**
 * Today's decision stack: one event at a time — Not for me / Save / Register.
 * Every choice is saved to the pipeline immediately. Registering opens the organiser's page;
 * the event is only marked "Registered" when Vikram confirms he completed it.
 */
export function TodayDeck({ items, days }: { items: DeckItem[]; days: DayCell[] }) {
  const router = useRouter();
  const [day, setDay] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, Status>>({});
  const [confirming, setConfirming] = useState<DeckItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pool = useMemo(() => items.filter((i) => !decided[i.id] && (!day || i.day === day)), [items, decided, day]);
  const card = confirming ?? pool[0] ?? null;
  const total = items.length;
  const doneCount = Object.keys(decided).length;

  const decide = useCallback(
    async (item: DeckItem, status: Status) => {
      setError(null);
      setBusy(true);
      try {
        await setStatus(item.id, status);
        setDecided((d) => ({ ...d, [item.id]: status }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const register = useCallback(
    async (item: DeckItem) => {
      if (item.registrationUrl) window.open(item.registrationUrl, "_blank", "noopener,noreferrer");
      setError(null);
      try {
        await setStatus(item.id, "to_register");
        setConfirming(item);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [],
  );

  const finishConfirm = async (registered: boolean) => {
    if (!confirming) return;
    if (registered) await decide(confirming, "registered");
    else setDecided((d) => ({ ...d, [confirming.id]: "to_register" }));
    setConfirming(null);
  };

  // Keyboard: ← not for me · ↓ save · → register (ignored while typing).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (busy || confirming || !pool[0] || /input|textarea|select/i.test(t.tagName) || t.isContentEditable) return;
      if (ev.key === "ArrowLeft") decide(pool[0], "dismissed");
      else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        decide(pool[0], "saved");
      } else if (ev.key === "ArrowRight") register(pool[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pool, busy, confirming, decide, register]);

  // Refresh the side panels once the stack is cleared.
  const cleared = total > 0 && !card && !day;
  useEffect(() => {
    if (cleared) router.refresh();
  }, [cleared, router]);

  return (
    <div className="flex flex-col gap-5">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Pick a day">
        {days.map((d) => {
          const on = day === d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              onClick={() => setDay(on ? null : d.key)}
              className={`flex min-h-[84px] w-[70px] shrink-0 flex-col items-center justify-center gap-1 rounded-[18px] transition ${on ? "bg-brand text-white" : d.isToday ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "bg-[#EAE7DF] text-ink hover:bg-[#E2DED4]"}`}
            >
              <span className="text-xs opacity-75">{d.isToday ? "Today" : d.dow}</span>
              <span className="text-[22px] leading-none font-semibold">{d.num}</span>
              <span className="flex h-1.5 gap-[3px]">
                {d.dots.slice(0, 4).map((c, i) => (
                  <span key={i} className="size-1.5 rounded-full" style={{ background: on ? "#fff" : c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Worth a look <span className="font-normal text-faint">· {pool.length} to decide</span>
        </h2>
        <span className="hidden text-[13px] text-faint sm:inline">{day ? "Tap the day again to see all" : "← not for me · ↓ save · → register"}</span>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-urgent-soft px-4 py-3 text-sm text-urgent">
          {error}
        </p>
      )}

      {card ? (
        <article key={card.id + (confirming ? "-c" : "")} className="animate-deal overflow-hidden rounded-[26px] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_14px_44px_rgb(31_35_28/0.09)]">
          <div className="relative h-[180px] overflow-hidden" style={{ background: card.hue.tint }}>
            {card.image ? (
              <>
                <img src={card.image} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
              </>
            ) : (
              <svg width="100%" height="180" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0">
                <circle cx={80 + (card.title.length * 37) % 420} cy="40" r="125" fill={card.hue.shape} opacity="0.55" />
                <circle cx="520" cy="200" r="95" fill={card.hue.shape} opacity="0.35" />
              </svg>
            )}
            <div className="absolute top-4 left-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1 text-[12.5px] font-semibold">{card.category}</span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-[12.5px]">{card.source}</span>
            </div>
            <div className="absolute top-4 right-5 flex size-16 flex-col items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgb(0_0_0/0.1)]" title={card.rulesOnly ? "Scored by rules — Gemini assessment pending" : "Fit with your focus areas"}>
              <span className="text-xl leading-none font-bold" style={{ color: card.hue.ink }}>
                {card.fit ?? "–"}
              </span>
              <span className="text-[10px] tracking-[0.08em] text-faint">FIT</span>
            </div>
          </div>
          <div className="flex flex-col gap-3.5 px-6 pt-5 pb-6">
            <h3 className="font-serif text-[clamp(26px,3vw,32px)] leading-[1.1]">
              <Link href={`/events/${card.id}`} className="text-ink no-underline hover:underline hover:decoration-1 hover:underline-offset-4">
                {card.title}
              </Link>
            </h3>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="3" />
                  <path d="M8 3v4M16 3v4M3 10h18" />
                </svg>
                {card.when}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                {card.where}
              </span>
            </div>
            {card.why && <p className="text-[15.5px] leading-relaxed text-ink-2">{card.why}</p>}
            <div className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: card.daysLeft != null && card.daysLeft <= 2 ? "var(--urgent-soft)" : card.daysLeft != null ? "var(--warn-soft)" : "#F6F4EF" }}>
              <Ring daysLeft={card.daysLeft} />
              <span className="flex flex-col">
                <span className="font-semibold" style={{ color: card.daysLeft != null ? (card.daysLeft <= 2 ? "var(--urgent)" : "var(--warn)") : "var(--muted)" }}>
                  {card.deadlineTitle}
                </span>
                <span className="text-[13px] text-muted">{card.deadlineSub}</span>
              </span>
            </div>

            {confirming ? (
              <div className="flex flex-col gap-3 rounded-2xl bg-brand-soft p-4">
                <p className="text-[15px] font-medium text-brand-ink">We opened the registration page in a new tab. Did you complete it?</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => finishConfirm(true)} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-ink">
                    Yes, I&apos;m registered
                  </button>
                  <button type="button" onClick={() => finishConfirm(false)} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-medium">
                    Not yet — keep it on my list
                  </button>
                  <a href={card.gcalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink no-underline">
                    Add to Google Calendar
                  </a>
                  <a href={card.icsUrl} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink no-underline">
                    Outlook / Apple
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 pt-1">
                <button type="button" disabled={busy} onClick={() => decide(card, "dismissed")} className="min-h-[52px] flex-[1_1_120px] rounded-2xl border border-line bg-surface text-[15px] font-medium transition hover:border-faint disabled:opacity-60">
                  Not for me
                </button>
                <button type="button" disabled={busy} onClick={() => decide(card, "saved")} className="min-h-[52px] flex-[1_1_120px] rounded-2xl border border-line bg-surface text-[15px] font-medium transition hover:border-faint disabled:opacity-60">
                  Save for later
                </button>
                <button type="button" disabled={busy} onClick={() => register(card)} className="min-h-[52px] flex-[1.4_1_170px] rounded-2xl text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: card.hue.ink }}>
                  {card.registrationUrl ? "Register" : "I'll register"}
                </button>
              </div>
            )}
          </div>
        </article>
      ) : (
        <div className="animate-deal flex flex-col items-center gap-2 rounded-[26px] bg-surface px-7 py-12 text-center shadow-[var(--shadow-soft)]">
          <span className="font-serif text-[36px] leading-tight">{day ? "Nothing new that day." : total === 0 ? "No new matches right now." : "All caught up."}</span>
          <span className="max-w-md text-muted">
            {day
              ? "Pick another day, or tap the same day to see everything."
              : total === 0
                ? "New events arrive every morning at 05:00. You can also explore everything or add one from a link."
                : `You decided on ${doneCount} event${doneCount === 1 ? "" : "s"}. New matches arrive tomorrow at 05:00.`}
          </span>
          <div className="mt-3 flex gap-2">
            <Link href="/events" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-medium text-ink no-underline">
              Explore all events
            </Link>
            <Link href="/pipeline" className="inline-flex min-h-11 items-center rounded-full bg-night px-5 text-sm font-medium text-white no-underline hover:text-white">
              My events
            </Link>
          </div>
        </div>
      )}

      {pool.length > 1 && !confirming && (
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1" aria-label="Up next">
          {pool.slice(1, 5).map((u) => (
            <Link key={u.id} href={`/events/${u.id}`} className="flex w-[220px] shrink-0 flex-col gap-1.5 rounded-[18px] bg-surface px-4 py-3.5 text-ink no-underline shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:-translate-y-0.5 hover:text-ink hover:shadow-[var(--shadow-soft)]">
              <span className="h-1.5 w-7 rounded-full" style={{ background: u.hue.shape }} />
              <span className="line-clamp-2 text-sm leading-snug font-semibold">{u.title}</span>
              <span className="text-[12.5px] text-faint">
                {u.when.split(" · ")[0]} · fit {u.fit ?? "–"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
