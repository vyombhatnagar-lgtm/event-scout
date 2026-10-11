"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-9 self-start text-left text-[#c9cdc5] underline hover:text-white"
      onClick={async () => {
        await fetch("/api/auth/login", { method: "DELETE" });
        router.replace("/login");
      }}
    >
      Sign out
    </button>
  );
}
