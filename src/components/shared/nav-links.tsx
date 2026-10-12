"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Today", match: ["/dashboard"] },
  { href: "/events", label: "Explore", match: ["/events"] },
  { href: "/pipeline", label: "My events", match: ["/pipeline", "/checklist"] },
  { href: "/digest", label: "Briefing", match: ["/digest"] },
  { href: "/settings", label: "Settings", match: ["/settings", "/status"] },
] as const;

export function NavLinks() {
  return <NavList path={usePathname()} />;
}

/** Pill navigation; rendered without an active state while the path streams in. */
export function NavList({ path }: { path: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
      {LINKS.map((l) => {
        const active = path != null && l.match.some((m) => path === m || (path.startsWith(`${m}/`) && !(m === "/events" && path === "/events/new")));
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`block rounded-full px-4 py-2 text-sm whitespace-nowrap no-underline transition ${active ? "bg-night font-medium text-white hover:text-white" : "text-ink-2 hover:bg-line-2 hover:text-ink"}`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
