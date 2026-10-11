"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/checklist", label: "Checklist" },
  { href: "/digest", label: "Digest" },
  { href: "/settings", label: "Preferences" },
  { href: "/status", label: "System status" },
] as const;

export function NavLinks() {
  return <NavList path={usePathname()} />;
}

/** Same links with no active state — rendered while the current path streams in. */
export function NavList({ path }: { path: string | null }) {
  return (
    <ul className="flex flex-wrap gap-0.5 md:flex-col">
      {LINKS.map((l) => {
        const active = path != null && (path === l.href || path.startsWith(`${l.href}/`));
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`block rounded-md px-3 py-2.5 text-sm no-underline ${active ? "bg-[#262b31] font-semibold text-white hover:text-white" : "text-[#c9cdc5] hover:bg-[#1b1f24] hover:text-white"}`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
