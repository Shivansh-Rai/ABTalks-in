"use client";

import Link from "next/link";
import { BadgeCheck, Clock, KeyRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepMotion } from "../motion";
import {
  OnboardingNavigation,
  OnboardingStep,
  StaggerItem,
} from "../onboarding-step";

const POINTS: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: Clock,
    title: "About two minutes",
    body: "Three short steps. Only your name, work email and company are required.",
  },
  {
    Icon: KeyRound,
    title: "No password",
    body: "We verify your work email with a 6-digit code.",
  },
  {
    Icon: BadgeCheck,
    title: "Verified work, not resumes",
    body: "Scout ranks candidates on what they have actually built.",
  },
];

/** White outline secondary — matches DS surface buttons (border + soft elevation). */
const SIGN_IN_BUTTON = cn(
  "inline-flex h-12 min-w-[132px] items-center justify-center rounded-[14px] px-6",
  "border border-[#E0E0E0] bg-white text-base font-semibold leading-5 text-[#161616]",
  "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.06)]",
  "transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-spark)]",
  "hover:border-[#D2D2D2] hover:bg-[#FBFBFB] hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.08)]",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#03535F]",
  "sm:min-w-[160px]",
);

export function WelcomeStep({
  motion,
  focusHeading,
  onStart,
  offerSignIn = false,
}: {
  motion: StepMotion;
  focusHeading: boolean;
  onStart: () => void;
  /** When true, Sign in button sits beside Set up workspace. */
  offerSignIn?: boolean;
}) {
  return (
    <OnboardingStep
      motion={motion}
      focusHeading={focusHeading}
      eyebrow="ABTalks Hire"
      title="Let’s build your recruiting workspace."
      description={
        <p>
          Tell us who you are and where you hire. ABTalks uses it to set up your
          workspace, so you can start searching for candidates straight away.
        </p>
      }
      onSubmit={onStart}
      actions={
        <OnboardingNavigation
          primaryLabel="Set up workspace"
          secondary={
            offerSignIn ? (
              <Link href="/recruiter-onboarding/signin" className={SIGN_IN_BUTTON}>
                Sign in
              </Link>
            ) : undefined
          }
        />
      }
    >
      <StaggerItem>
        <ul className="space-y-4">
          {POINTS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF6F6] text-[#03535F]">
                <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[#161616]">{title}</p>
                <p className="mt-0.5 text-sm leading-6 text-[#626262]">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </StaggerItem>
    </OnboardingStep>
  );
}
