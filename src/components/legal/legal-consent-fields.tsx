"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type LegalConsentValues = {
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  confirmAge18: boolean;
};

type Props = {
  values: LegalConsentValues;
  onChange: (next: LegalConsentValues) => void;
  className?: string;
  /** Optional extra checkboxes rendered after the legal trio. */
  children?: React.ReactNode;
};

export function LegalConsentFields({
  values,
  onChange,
  className,
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
          className="mt-0.5"
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
          className="mt-0.5"
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
          className="mt-0.5"
          aria-label="Confirm age 18 or older"
        />
        <Label className="font-normal leading-snug">
          I confirm that I am 18 years of age or older.
        </Label>
      </label>
      {children}
    </div>
  );
}

export function legalConsentAccepted(values: LegalConsentValues): boolean {
  return values.acceptTerms && values.acceptPrivacy && values.confirmAge18;
}
