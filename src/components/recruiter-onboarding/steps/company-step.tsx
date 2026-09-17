"use client";

import { updateRecruiterProfileSchema } from "@/lib/validations/recruiter-profile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StepMotion } from "../motion";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  type OnboardingDraft,
} from "../onboarding-draft";
import { ChipGroup, Field, INPUT_CLASS, fieldA11y } from "../onboarding-fields";
import { OnboardingNavigation, OnboardingStep, StaggerItem } from "../onboarding-step";

export type CompanyErrors = { company?: string; website?: string };

/**
 * The name follows `registerRecruiterSchema`. The optional fields are saved
 * later through `updateRecruiterProfileAction`, so they are checked with that
 * schema's own field validators — a website the settings page would refuse
 * is refused here too.
 */
export function validateCompany(draft: OnboardingDraft): CompanyErrors {
  const errors: CompanyErrors = {};
  if (draft.company.trim().length < 2) errors.company = "Enter your company name.";
  const website = draft.website.trim();
  if (website && !isValidWebsite(website)) {
    errors.website = "Enter a valid website, like company.com.";
  }
  return errors;
}

/**
 * The settings schema, plus the settings form's own client rule. Chrome's URL
 * parser percent-encodes a space in a hostname instead of rejecting it, so
 * "not a site" passes the schema in the browser and fails it on the server —
 * the same gap `validateWebsiteInput` in recruiter-profile-form.tsx closes.
 */
function isValidWebsite(value: string): boolean {
  if (/\s/.test(value)) return false;
  const parsed = updateRecruiterProfileSchema.shape.website.safeParse(value);
  if (!parsed.success || !parsed.data) return false;
  try {
    return new URL(parsed.data).hostname.includes(".");
  } catch {
    return false;
  }
}

export const COMPANY_FIELD_IDS: Record<keyof CompanyErrors, string> = {
  company: "ob-company",
  website: "ob-website",
};

const SIZE_OPTIONS = COMPANY_SIZES.map((size) => ({ value: size, label: size }));

export function CompanyStep({
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
  const errors = validateCompany(draft);
  const shown = showErrors ? errors : {};

  return (
    <OnboardingStep
      motion={motion}
      focusHeading={focusHeading}
      eyebrow="Step 2 of 3 · Company"
      title="Tell us about your company"
      description={
        <p>
          Shown on your outreach and job posts. Only the name is required — you
          can fill in the rest later in Settings.
        </p>
      }
      onSubmit={onNext}
      actions={<OnboardingNavigation onBack={onBack} primaryLabel="Continue" />}
    >
      <StaggerItem>
        <Field
          id="ob-company"
          label="Company name"
          error={shown.company}
          valid={!errors.company}
        >
          <input
            id="ob-company"
            autoComplete="organization"
            maxLength={200}
            placeholder="Acme Technologies"
            value={draft.company}
            onChange={(e) => onChange({ company: e.target.value })}
            {...fieldA11y("ob-company", shown.company)}
            className={INPUT_CLASS}
          />
        </Field>
      </StaggerItem>

      <StaggerItem className="grid gap-6 sm:grid-cols-2 sm:gap-4">
        <Field id="ob-website" label="Website" optional error={shown.website}>
          <input
            id="ob-website"
            type="url"
            inputMode="url"
            autoComplete="url"
            maxLength={200}
            placeholder="company.com"
            value={draft.website}
            onChange={(e) => onChange({ website: e.target.value })}
            {...fieldA11y("ob-website", shown.website)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field id="ob-industry" label="Industry" optional>
          <Select
            value={draft.industry || null}
            onValueChange={(value) => onChange({ industry: value ?? "" })}
          >
            <SelectTrigger
              id="ob-industry"
              className={cn(
                INPUT_CLASS,
                "w-full justify-between pr-3 data-[size=default]:h-12 data-placeholder:text-[#A5A5A5]",
              )}
            >
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              sideOffset={6}
              className="rounded-[12px] border border-[#E9E9E9] bg-white p-1 text-[#161616] shadow-[0_16px_40px_-16px_rgba(16,41,44,0.3)] ring-0 duration-150"
            >
              {INDUSTRIES.map((industry) => (
                <SelectItem
                  key={industry}
                  value={industry}
                  className="min-h-10 rounded-lg px-3 text-[15px] focus:bg-[#EEF6F6] focus:text-[#03535F]"
                >
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </StaggerItem>

      <StaggerItem>
        <ChipGroup
          label="Company size"
          options={SIZE_OPTIONS}
          value={draft.companySize}
          onChange={(companySize) => onChange({ companySize })}
        />
      </StaggerItem>

      <StaggerItem>
        <Field id="ob-hq" label="Headquarters" optional>
          <input
            id="ob-hq"
            autoComplete="address-level2"
            maxLength={120}
            placeholder="Bengaluru, India"
            value={draft.companyLocation}
            onChange={(e) => onChange({ companyLocation: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
      </StaggerItem>
    </OnboardingStep>
  );
}
