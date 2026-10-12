import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, NavList } from "@/components/shared/nav-links";
import { SignOutButton } from "@/components/shared/sign-out";
import { buttonCls } from "@/components/shared/ui";
import { authEnabled } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4F2ED" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M20 20l-4-4" />
            </svg>
          </span>
          <span className="text-base font-semibold">Event Scout</span>
        </Link>
        <nav aria-label="Primary" className="order-3 w-full sm:order-none sm:w-auto">
          <Suspense fallback={<NavList path={null} />}>
            <NavLinks />
          </Suspense>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/events/new" className={buttonCls.pill}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add from a link
          </Link>
          {authEnabled() && <SignOutButton />}
        </div>
      </header>
      <main className="mx-auto flex max-w-[1160px] flex-col gap-7 px-4 pt-8 pb-16 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-[1160px] px-4 pb-10 text-xs text-faint sm:px-6">
        Live events from Luma, Eventbrite, Meetup, AllEvents, NASSCOM, iSPIRT and web search · ranked with Gemini Flash · times in IST ·{" "}
        <Link href="/status" className="text-faint underline">
          System status
        </Link>
      </footer>
    </div>
  );
}
