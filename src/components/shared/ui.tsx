import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[22px] bg-surface shadow-[var(--shadow-soft)] ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-3xl flex-col gap-2">
        {eyebrow && <span className="text-sm text-muted">{eyebrow}</span>}
        <h1 className="font-serif text-[clamp(34px,4.6vw,48px)] leading-[1.05] font-normal tracking-[-0.01em]">{title}</h1>
        {sub && <div className="text-[15px] leading-relaxed text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ id, children, aside }: { id?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[17px] font-semibold">
        {children}
      </h2>
      {aside && <div className="text-sm text-muted">{aside}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "urgent" | "ok" | "warn" | "night";
const TONES: Record<Tone, string> = {
  neutral: "bg-line-2 text-ink-2",
  accent: "bg-brand-soft text-brand",
  urgent: "bg-urgent-soft text-urgent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  night: "bg-night text-white",
};

export function Badge({ tone = "neutral", children, title, style }: { tone?: Tone; children: ReactNode; title?: string; style?: React.CSSProperties }) {
  return (
    <span title={title} style={style} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style ? "" : TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Circular fit score. */
export function ScoreRing({ score, size = 60 }: { score: number | null; size?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-full bg-surface shadow-[0_4px_14px_rgb(0_0_0/0.08)]"
      style={{ width: size, height: size }}
      aria-label={score == null ? "Not yet scored" : `Fit score ${score} out of 100`}
    >
      <span className={`leading-none font-bold ${score == null ? "text-faint" : "text-brand"}`} style={{ fontSize: size * 0.32 }}>
        {score ?? "–"}
      </span>
      <span className="text-[10px] tracking-[0.08em] text-faint">FIT</span>
    </div>
  );
}

/** Countdown ring: fills as a deadline approaches (7 days → empty, 0 → full). */
export function CountdownRing({ daysLeft, size = 46, label }: { daysLeft: number | null; size?: number; label?: string }) {
  const known = daysLeft != null;
  const color = !known ? "#8A8E83" : daysLeft! <= 2 ? "var(--urgent)" : daysLeft! <= 7 ? "#B7791F" : "var(--ok)";
  const frac = known ? Math.max(0.06, Math.min(1, (7 - Math.min(daysLeft!, 7)) / 7)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#EEEAE1" strokeWidth="3.5" />
        {known && <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${Math.round(frac * 94)} 100`} transform="rotate(-90 18 18)" />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold" style={{ color }}>
        {label ?? (known ? (daysLeft! < 1 ? "<1d" : `${daysLeft}d`) : "?")}
      </span>
    </div>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "urgent" }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-surface p-5 shadow-[var(--shadow-soft)]">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`text-[30px] leading-none font-semibold tracking-tight ${tone === "urgent" ? "text-urgent" : ""}`}>{value}</span>
      {note && <span className="text-xs text-faint">{note}</span>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[22px] bg-surface px-6 py-12 text-center shadow-[var(--shadow-soft)]">
      <p className="font-serif text-[28px] leading-tight">{title}</p>
      {children && <div className="max-w-md text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "urgent" | "ok"; children: ReactNode }) {
  const cls = tone === "urgent" ? "bg-urgent-soft text-urgent" : tone === "ok" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn";
  return <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13.5px] ${cls}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[22px] bg-line-2 ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <Skeleton className="h-14 w-2/3" />
      <div className="flex gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-[72px] shrink-0" />
        ))}
      </div>
      <div className="flex flex-wrap gap-6">
        <Skeleton className="h-[460px] flex-[999_1_520px]" />
        <Skeleton className="h-[460px] flex-[1_1_320px]" />
      </div>
    </div>
  );
}

export const buttonCls = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-white no-underline transition hover:bg-brand-ink hover:text-white disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-medium text-ink no-underline transition hover:border-faint hover:text-ink disabled:opacity-60",
  small:
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink no-underline transition hover:border-faint hover:text-ink disabled:opacity-60",
  smallPrimary:
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand px-3.5 text-[13px] font-semibold text-white no-underline transition hover:bg-brand-ink hover:text-white",
  pill: "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink no-underline shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition hover:border-faint hover:text-ink",
};

export const fieldCls = "min-h-11 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition focus:border-brand";
