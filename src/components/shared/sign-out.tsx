"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-10 rounded-full px-3 text-sm text-muted hover:text-ink"
      onClick={async () => {
        await fetch("/api/auth/login", { method: "DELETE" });
        router.replace("/login");
      }}
    >
      Sign out
    </button>
  );
}
