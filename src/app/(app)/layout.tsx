import { Suspense } from "react";
import { NavLinks, NavList } from "@/components/shared/nav-links";
import { SignOutButton } from "@/components/shared/sign-out";
import { authEnabled } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <nav aria-label="Primary" className="flex w-full flex-col gap-6 bg-nav px-5 py-6 text-[#e9ebe6] md:sticky md:top-0 md:h-screen md:w-[232px] md:py-7">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e9ebe6" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5M11 7v4l2.5 2" />
          </svg>
          <div className="flex flex-col">
            <span className="text-[17px] font-bold">Event Scout</span>
            <span className="text-xs text-[#a9afa6]">Find the right rooms.</span>
          </div>
        </div>
        <Suspense fallback={<NavList path={null} />}>
          <NavLinks />
        </Suspense>
        <div className="mt-auto hidden flex-col gap-2 border-t border-[#2e343b] pt-4 text-xs text-[#a9afa6] md:flex">
          <span>AI: Gemini Flash</span>
          <span>Times shown in IST</span>
          {authEnabled() && <SignOutButton />}
        </div>
      </nav>
      <main className="min-w-0 flex-[999_1_560px] px-4 pt-8 pb-12 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-7">{children}</div>
      </main>
    </div>
  );
}
