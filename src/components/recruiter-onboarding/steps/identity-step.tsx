"use client";

import {
  WORK_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmailDomain,
} from "@/lib/validations/work-email";
import type { StepMotion } from "../motion";
import type { OnboardingDraft } from "../onboarding-draft";
import { EMAIL_RE, Field, INPUT_CLASS, fieldA11y } from "../onboarding-fields";
import { OnboardingNavigation, OnboardingStep, StaggerItem } from "../onboarding-step";

export type IdentityErrors = { fullName?: string; email?: string };

/**
 * Mirrors `registerRecruiterSchema` so the recruiter hears about a problem
 * here rather than after a code has been sent. The personal-domain list is
 * the server's own, imported, not copied.
 */
export function validateIdentity(draft: OnboardingDraft): IdentityErrors {
  const errors: IdentityErrors = {};
  const name = draft.fullName.trim();
  if (name.length < 2) errors.fullName = "Enter your full name.";
  // Mirrors `registerRecruiterSchema`, so the wizard says so at the field
  // instead of letting the step pass and failing at submit.
  else if (/\p{Nd}/u.test(name)) errors.fullName = "Full name cannot contain numbers.";
  const email = draft.email.trim();
  if (!EMAIL_RE.test(email)) errors.email = "Enter a valid work email address.";
  else if (isPersonalEmailDomain(email)) errors.email = WORK_EMAIL_REQUIRED_MESSAGE;
  return errors;
}

export function IdentityStep({
  motion,
  focusHeading,
  draft,
  showErrors,
  onChange,
  onBack,
  onNext,
}: {
  motion: StepMotion;
  focusHeading: boolean;
  draft: OnboardingDraft;
  showErrors: boolean;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const errors = validateIdentity(draft);
  const shown = showErrors ? errors : {};

  return (
    <OnboardingStep
      motion={motion}
      focusHeading={focusHeading}
      eyebrow="Step 1 of 3 · You"
      title="First, who’s hiring?"
      description={
        <p>
          Your name appears when you reach out to candidates. Your work email is
          how you sign in — there’s no password.
        </p>
      }
      onSubmit={onNext}
      actions={<OnboardingNavigation onBack={onBack} primaryLabel="Continue" />}
    >
      <StaggerItem>
        <Field
          id="ob-name"
          label="Full name"
          error={shown.fullName}
          valid={!errors.fullName}
        >
          <input
            id="ob-name"
            autoComplete="name"
            maxLength={120}
            placeholder="Priya Sharma"
            value={draft.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            {...fieldA11y("ob-name", shown.fullName)}
            className={INPUT_CLASS}
          />
        </Field>
      </StaggerItem>
      <StaggerItem>
        <Field
          id="ob-email"
          label="Work email"
          hint="Use your company address. We’ll send a 6-digit code to verify it at the end."
          error={shown.email}
          valid={!errors.email}
        >
          <input
            id="ob-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={200}
            placeholder="you@company.com"
            value={draft.email}
            onChange={(e) => onChange({ email: e.target.value })}
            {...fieldA11y(
              "ob-email",
              shown.email,
              "Use your company address. We’ll send a 6-digit code to verify it at the end.",
            )}
            className={INPUT_CLASS}
          />
        </Field>
      </StaggerItem>
    </OnboardingStep>
  );
}

/** Ids of the fields in order, so a failed submit can focus the first bad one. */
export const IDENTITY_FIELD_IDS: Record<keyof IdentityErrors, string> = {
  fullName: "ob-name",
  email: "ob-email",
};
