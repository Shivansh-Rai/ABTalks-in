"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type LegalConsentValues = {
  /** Combined Terms of Service + Privacy Policy acceptance. */
  acceptLegal: boolean;
  /** Marketing opt-in. Pre-checked; never gates submission. */
  newsletterOptIn: boolean;
};

/** Every funnel starts from this — newsletter on, legal box off. */
export const DEFAULT_LEGAL_CONSENT: LegalConsentValues = {
  acceptLegal: false,
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
  /** Optional extra checkboxes rendered after the legal pair. */
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
          checked={values.acceptLegal}
          onCheckedChange={(c) =>
            onChange({ ...values, acceptLegal: c === true })
          }
          className="mt-0.5 size-4 border-foreground/50 bg-background shadow-sm"
          aria-label="Accept Terms of Service and Privacy Policy"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </span>
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
  return values.acceptLegal === true;
}
