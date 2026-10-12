"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_OPTIONS, CITY_OPTIONS, FORMAT_LABELS, type Preferences } from "@/types/preferences";

const input = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm";

const CHIP_COLORS = ["#1F5F4A", "#2A4A8A", "#7A4E0F", "#5B3E96", "#8E2F45", "#1D6B66", "#8A3B16", "#3C4656"];

function ChipGroup({ legend, options, value, onChange }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = [...new Set([...options, ...value])];
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{legend}</legend>
      {all.map((o, i) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            style={on ? { background: CHIP_COLORS[i % CHIP_COLORS.length], borderColor: CHIP_COLORS[i % CHIP_COLORS.length] } : undefined}
            className={`min-h-10 rounded-full border px-4 text-[13px] transition ${on ? "font-medium text-white" : "border-line bg-surface text-ink-2 hover:border-faint"}`}
          >
            {o}
          </button>
        );
      })}
    </fieldset>
  );
}

export function PreferencesForm({ initial, isDefault }: { initial: Preferences; isDefault: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [newCity, setNewCity] = useState("");
  const [topicsText, setTopicsText] = useState(initial.topics.join(", "));
  const [state, setState] = useState<{ kind: "idle" | "saving" | "ranking" | "done" | "error"; msg?: string }>({ kind: "idle" });
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => setP((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "saving" });
    const body = { ...p, topics: topicsText.split(",").map((t) => t.trim()).filter(Boolean), digestEmail: p.digestEmail ?? "", calendlyUrl: p.calendlyUrl ?? "" };
    const res = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (!res?.ok) {
      const err = await res?.json().catch(() => null);
      setState({ kind: "error", msg: err?.error ?? "Could not save preferences" });
      return;
    }
    setState({ kind: "ranking" });
    const job = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ job: "scoring" }) }).catch(() => null);
    setState(job?.ok ? { kind: "done", msg: "Saved. Events have been reranked with your new preferences." } : { kind: "done", msg: "Saved. Reranking will finish on the next scheduled run." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {isDefault && <p className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">These are the starting defaults. Edit and save to make them yours.</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-6">
          <h2 className="text-[17px] font-semibold">Professional categories</h2>
          <p className="text-[13px] text-muted">Event types you want ranked higher.</p>
          <ChipGroup legend="Categories" options={CATEGORY_OPTIONS} value={p.categories} onChange={(v) => set("categories", v)} />
        </section>

        <section className="flex flex-col gap-3 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-6">
          <h2 className="text-[17px] font-semibold">Target cities</h2>
          <p className="text-[13px] text-muted">Discovery searches these cities. In person events elsewhere are capped at a low score.</p>
          <ChipGroup legend="Cities" options={CITY_OPTIONS} value={p.cities} onChange={(v) => set("cities", v)} />
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium">
              Add a city
              <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="e.g. Kochi" className={input} />
            </label>
            <button
              type="button"
              className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm"
              onClick={() => {
                const c = newCity.trim();
                if (c && !p.cities.includes(c)) set("cities", [...p.cities, c]);
                setNewCity("");
              }}
            >
              Add
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-6">
          <h2 className="text-[17px] font-semibold">Industries and topics</h2>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Topics (comma separated), used by the rules and by Gemini to judge fit
            <textarea rows={3} value={topicsText} onChange={(e) => setTopicsText(e.target.value)} className="rounded-xl border border-line p-3 text-sm" />
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-[13px] font-medium">Formats</legend>
            {(["in_person", "hybrid", "online"] as const).map((f) => (
              <label key={f} className="flex min-h-9 items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={p.formats.includes(f)}
                  onChange={(e) => set("formats", e.target.checked ? [...p.formats, f] : p.formats.filter((x) => x !== f))}
                  className="size-[18px] accent-[var(--brand)]"
                />
                {FORMAT_LABELS[f]}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-6">
          <h2 className="text-[17px] font-semibold">Ranking and digest</h2>
          <label className="flex flex-col gap-2 text-[13px] font-medium">
            <span className="flex justify-between">
              Minimum fit score <span className="font-mono">{p.minScore}</span>
            </span>
            <input type="range" min={0} max={100} step={5} value={p.minScore} onChange={(e) => set("minScore", Number(e.target.value))} className="accent-[var(--brand)]" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Digest recipient
            <input type="email" value={p.digestEmail ?? ""} onChange={(e) => set("digestEmail", e.target.value)} placeholder="you@example.com" className={input} />
          </label>
          <label className="flex min-h-9 items-center gap-2.5 text-sm">
            <input type="checkbox" checked={p.digestEnabled} onChange={(e) => set("digestEnabled", e.target.checked)} className="size-[18px] accent-[var(--brand)]" />
            Send the digest every Monday at 06:30 IST
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Calendly booking link
            <input type="url" value={p.calendlyUrl ?? ""} onChange={(e) => set("calendlyUrl", e.target.value)} placeholder="https://calendly.com/your-link" className={input} />
          </label>
        </section>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state.kind === "saving" || state.kind === "ranking"} className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60">
          {state.kind === "saving" ? "Saving…" : state.kind === "ranking" ? "Reranking events…" : "Save preferences"}
        </button>
        {state.msg && (
          <p role="status" className={`text-sm ${state.kind === "error" ? "text-urgent" : "text-ok"}`}>
            {state.msg}
          </p>
        )}
      </div>
    </form>
  );
}
