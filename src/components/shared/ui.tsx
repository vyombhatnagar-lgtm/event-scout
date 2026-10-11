import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-surface ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow && <span className="font-mono text-[13px] text-muted uppercase">{eyebrow}</span>}
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">{title}</h1>
        {sub && <div className="text-[15px] text-muted">{sub}</div>}
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
      {aside && <div className="text-sm">{aside}</div>}
    </div>
  );
}

type Tone = "neutral" | "accent" | "urgent" | "ok" | "warn";
const TONES: Record<Tone, string> = {
  neutral: "bg-line-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  urgent: "bg-urgent-soft text-urgent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn-ink",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ScoreRing({ score, size = 56 }: { score: number | null; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex items-center justify-center rounded-full border-[3px] font-mono font-medium ${score == null ? "border-line text-muted" : "border-accent text-accent"}`}
        style={{ width: size, height: size, fontSize: size * 0.33 }}
        aria-label={score == null ? "Not yet scored" : `Fit score ${score} out of 100`}
      >
        {score ?? "–"}
      </div>
      <span className="text-[11px] tracking-wider text-muted uppercase">Fit</span>
    </div>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: "urgent" }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-[18px]">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`font-mono text-[32px] leading-none font-medium ${tone === "urgent" ? "text-urgent" : ""}`}>{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "urgent" | "ok"; children: ReactNode }) {
  const cls = tone === "urgent" ? "bg-urgent-soft text-urgent border-[#f0d5c0]" : tone === "ok" ? "bg-ok-soft text-ok border-[#cfe0c4]" : "bg-warn-soft text-warn-ink border-[#ebd9a6]";
  return <div className={`flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-[13px] ${cls}`}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-line-2 ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );
}

export const buttonCls = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-ink hover:text-white disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-md border border-[#d5d8d1] bg-surface px-4 text-sm font-medium text-ink no-underline hover:border-ink-2 hover:text-ink disabled:opacity-60",
  small:
    "inline-flex min-h-10 items-center justify-center rounded-md border border-[#d5d8d1] bg-surface px-3 text-[13px] font-medium text-ink no-underline hover:border-ink-2 hover:text-ink disabled:opacity-60",
  smallPrimary:
    "inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-3.5 text-[13px] font-semibold text-white no-underline hover:bg-accent-ink hover:text-white",
};
