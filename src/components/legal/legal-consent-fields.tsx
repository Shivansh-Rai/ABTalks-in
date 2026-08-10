"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type LegalConsentValues = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  confirmAge18: boolean;
  /** Marketing opt-in. Pre-checked; never gates submission. */
  newsletterOptIn: boolean;
};

/** Every funnel starts from this — newsletter on, legal boxes off. */
export const DEFAULT_LEGAL_CONSENT: LegalConsentValues = {
  acceptTerms: false,
  acceptPrivacy: false,
  confirmAge18: false,
  newsletterOptIn: true,
};

type Props = {
  values: LegalConsentValues;
  onChange: (next: LegalConsentValues) => void;
  className?: string;
  /**
   * Marketing-checkbox copy. Defaults to learner-oriented wording; recruiter
   * and other funnels should pass a surface-specific label so we do not
   * advertise "challenges/workshops" to employers.
   */
  newsletterLabel?: ReactNode;
  /** Optional extra checkboxes rendered after the legal trio. */
  children?: ReactNode;
};

const DEFAULT_NEWSLETTER_LABEL = (
  <>
    Send me occasional updates about new challenges, workshops and
    opportunities.{" "}
    <span className="text-muted-foreground">
      Optional — untick to opt out, and you can unsubscribe any time.
    </span>
  </>
);

export function LegalConsentFields({
  values,
  onChange,
  className,
  newsletterLabel = DEFAULT_NEWSLETTER_LABEL,
  children,
}: Props) {
  return (
    <div className={cn("space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4", className)}>
      <label className="flex items-start gap-3 text-sm leading-snug">
        <Checkbox
          checked={values.acceptTerms}
          onCheckedChange={(c) =>
            onChange({ ...values, acceptTerms: c === true })
          }
          className="mt-0.5 size-4 border-foreground/50 bg-background shadow-sm"
          aria-label="Accept Terms of Service"
        />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
            Terms of Service
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-snug">
        <Checkbox
          checked={values.acceptPrivacy}
          onCheckedChange={(c) =>
            onChange({ ...values, acceptPrivacy: c === true })
          }
          className="mt-0.5 size-4 border-foreground/50 bg-background shadow-sm"
          aria-label="Accept Privacy Policy"
        />
        <span>
          I agree to the{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-snug">
        <Checkbox
          checked={values.confirmAge18}
          onCheckedChange={(c) =>
            onChange({ ...values, confirmAge18: c === true })
          }
          className="mt-0.5 size-4 border-foreground/50 bg-background shadow-sm"
          aria-label="Confirm age 18 or older"
        />
        <Label className="font-normal leading-snug">
          I confirm that I am 18 years of age or older.
        </Label>
      </label>
      {/* Optional and pre-selected. Deliberately excluded from
          legalConsentAccepted() so unticking it can never block signup. */}
      <label className="flex items-start gap-3 border-t border-border/60 pt-3 text-sm leading-snug">
        <Checkbox
          checked={values.newsletterOptIn}
          onCheckedChange={(c) =>
            onChange({ ...values, newsletterOptIn: c === true })
          }
          className="mt-0.5 size-4 border-foreground/50 bg-background shadow-sm"
          aria-label="Receive occasional updates by email"
        />
        <Label className="font-normal leading-snug">{newsletterLabel}</Label>
      </label>
      {children}
    </div>
  );
}

export function legalConsentAccepted(values: LegalConsentValues): boolean {
  return values.acceptTerms && values.acceptPrivacy && values.confirmAge18;
}
