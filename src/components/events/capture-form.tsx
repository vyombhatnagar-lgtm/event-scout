"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input = "min-h-11 rounded-xl border border-line bg-surface px-3 text-sm";

/** Add one event from a link and/or pasted text (LinkedIn post, email, newsletter). */
export function CaptureForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await fetch("/api/events/capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: f.get("url"), text: f.get("text") || null }),
        }).catch(() => null);
        const body = await res?.json().catch(() => ({}));
        if (res?.ok && body.ids?.length) {
          router.push(`/events/${body.ids[0]}`);
          return;
        }
        setError(body?.error ?? "Could not add the event. Try again.");
        setBusy(false);
      }}
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Link to the event or post
        <input name="url" type="url" required placeholder="https://www.linkedin.com/posts/… or any event page" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Announcement text <span className="font-normal text-muted">(required for LinkedIn and other sign in sites, copy the post and paste it here)</span>
        <textarea name="text" rows={8} className="rounded-xl border border-line p-3 text-sm" placeholder="Paste the post or email text…" />
      </label>
      <p className="text-xs text-muted">
        Gemini Flash reads the announcement; an event is added only if its name and date appear in the text. A registration deadline is added only if the text states one. The event is saved to your pipeline.
      </p>
      {error && (
        <p role="alert" className="text-sm text-urgent">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-11 self-start rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60">
        {busy ? "Reading the announcement…" : "Add event"}
      </button>
    </form>
  );
}
