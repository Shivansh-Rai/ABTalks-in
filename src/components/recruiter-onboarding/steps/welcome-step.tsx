"use client";

import { BadgeCheck, Clock, KeyRound, type LucideIcon } from "lucide-react";
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

export function WelcomeStep({
  motion,
  focusHeading,
  onStart,
}: {
  motion: StepMotion;
  focusHeading: boolean;
  onStart: () => void;
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
      actions={<OnboardingNavigation primaryLabel="Set up workspace" />}
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
