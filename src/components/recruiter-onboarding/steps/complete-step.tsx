"use client";

import { AlertCircle, Check } from "lucide-react";
import { motion as m } from "framer-motion";
import { EASE_SPARK } from "@/lib/motion";
import type { StepMotion } from "../motion";
import { OnboardingNavigation, OnboardingStep, StaggerItem } from "../onboarding-step";

/*
 * The finish. Shown once the recruiter is signed in; the supporting visual has
 * already reorganised into the workspace preview by the time this settles.
 * "Start discovering talent" goes where sign-in always went: /hire.
 */

export function CompleteStep({
  motion,
  focusHeading,
  company,
  pending,
  saveFailed,
  onFinish,
}: {
  motion: StepMotion;
  focusHeading: boolean;
  company: string;
  pending: boolean;
  /** Optional company details could not be saved; the CTA continues anyway. */
  saveFailed: boolean;
  onFinish: () => void;
}) {
  const items = ["Work email verified", `Workspace created for ${company}`];

  return (
    <OnboardingStep
      motion={motion}
      focusHeading={focusHeading}
      eyebrow="All set"
      title="Your recruiting workspace is ready."
      description={
        <p>
          Describe the role you’re hiring for and Scout will rank candidates on
          verified work.
        </p>
      }
      onSubmit={onFinish}
      actions={
        <OnboardingNavigation
          primaryLabel={saveFailed ? "Continue to workspace" : "Start discovering talent"}
          pending={pending}
        />
      }
    >
      <StaggerItem>
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={item} className="flex items-center gap-3 text-[15px] text-[#161616]">
              <m.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35 + i * 0.12, duration: 0.32, ease: EASE_SPARK }}
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#D6F7EC] text-[#03535F]"
              >
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </m.span>
              {item}
            </li>
          ))}
        </ul>
      </StaggerItem>
      {saveFailed && (
        <StaggerItem>
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[10px] border border-[#AA821D]/30 bg-[#FFEDB0]/50 px-3.5 py-3 text-sm text-[#6B5212]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            We couldn’t save your optional company details. You can add them any
            time in Settings.
          </p>
        </StaggerItem>
      )}
    </OnboardingStep>
  );
}
