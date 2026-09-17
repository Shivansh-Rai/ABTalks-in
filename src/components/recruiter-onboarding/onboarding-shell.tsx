import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

/*
 * The recruiter onboarding's full-height frame, shared by the wizard and the
 * sign-in screen:
 *
 *   header      logo · an aside (the "sign in" / "create an account" link)
 *   left        progress rail, then the step stage — top-aligned, so a step of
 *               a different height never shifts the one being read
 *   right       the supporting visual, desktop only (it renders nothing below
 *               1024px, see supporting-visual.tsx)
 *
 * Desktop never scrolls the page: the left column scrolls on its own if a step
 * is taller than the viewport. Phones scroll the page, and the step's actions
 * stick to the bottom of the screen.
 *
 * No hooks, so it renders from Server and Client Components alike.
 */

/**
 * DS v2 §9A clay depth, layered on `dsButtonVariants` — shared by every
 * onboarding CTA so they stay identical: lower inset shade + restrained teal
 * elevation; hover lifts the elevation; pressed is #02434D with deeper inset.
 * `[a]:` matches dsButtonVariants' own `[a]:hover:` rule, which otherwise
 * out-specifies a plain `active:` on links and keeps #076573.
 * (Copied in src/components/jobs/job-ui.ts — keep the two in sync.)
 */
export const CLAY_CTA = [
  "shadow-[inset_0_-4px_8px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.14),0_4px_12px_rgba(3,83,95,0.16)]",
  "hover:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.38),inset_0_1px_1px_rgba(255,255,255,0.14),0_8px_20px_rgba(3,83,95,0.28)]",
  "active:!bg-[#02434D] [a]:active:!bg-[#02434D] active:shadow-[inset_0_-1px_3px_rgba(0,0,0,0.28),inset_0_3px_6px_rgba(0,0,0,0.40),0_2px_6px_rgba(3,83,95,0.14)]",
  "disabled:shadow-none",
].join(" ");

export function OnboardingShell({
  aside,
  progress,
  visual,
  children,
}: {
  aside?: ReactNode;
  progress?: ReactNode;
  visual?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-white text-[#161616] lg:h-svh lg:overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link
          href="/"
          aria-label="ABTalks home"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#03535F]"
        >
          <Image
            src="/abt-logo2.png"
            alt="ABTalks"
            width={318}
            height={74}
            priority
            className="h-[26px] w-auto"
          />
        </Link>
        {aside}
      </header>

      <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:pb-5 lg:pr-5">
        <div
          data-onboarding-scroll
          className="flex flex-1 flex-col px-5 pb-6 sm:px-8 lg:min-h-0 lg:overflow-y-auto lg:pb-10 lg:pl-[clamp(40px,6vw,104px)] lg:pr-10"
        >
          <div className="mx-auto flex w-full max-w-[540px] flex-1 flex-col lg:mx-0">
            {progress && <div className="pt-1 lg:pt-[clamp(8px,4vh,40px)]">{progress}</div>}
            <div className="mt-6 flex-1 lg:mt-8">{children}</div>
          </div>
        </div>
        {visual}
      </div>
    </div>
  );
}
