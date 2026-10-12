"use client";

import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="flex min-h-screen items-center justify-center bg-ground px-4">
      <form
        className="flex w-full max-w-sm flex-col gap-4 rounded-[22px] bg-surface shadow-[var(--shadow-soft)] p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const password = new FormData(e.currentTarget).get("password");
          const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) }).catch(() => null);
          if (res?.ok) {
            const next = new URLSearchParams(window.location.search).get("next");
            window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
          } else {
            setError(res?.status === 401 ? "Incorrect password." : "Could not sign in. Try again.");
            setBusy(false);
          }
        }}
      >
        <div>
          <h1 className="font-serif text-[38px] leading-none">Event Scout</h1>
          <p className="mt-1 text-sm text-muted">Find the right rooms. Never miss the opportunity.</p>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="min-h-11 rounded-xl border border-line px-3 text-sm" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-urgent">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-ink disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
