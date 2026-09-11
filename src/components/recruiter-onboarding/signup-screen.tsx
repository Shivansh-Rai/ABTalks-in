"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  registerRecruiterWithOtpAction,
  requestRecruiterOtpAction,
} from "@/app/actions/recruiter-auth-actions";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { useTrack } from "@/lib/analytics/use-track";
import { dsButtonVariants } from "@/components/design/ds-button";
import { cn } from "@/lib/utils";
import { CLAY_CTA } from "./onboarding-shell";
import {
  AUTH_CTA_WRAP,
  AUTH_FOOTNOTE,
  AUTH_FOOTNOTE_LINK,
  AUTH_FORM,
  AUTH_INPUT,
  AUTH_LEAD,
  AUTH_TITLE,
  AuthError,
  AuthField,
  DevCodeNotice,
  EMAIL_RE,
  RecruiterAuthFrame,
} from "./recruiter-auth-frame";

/*
 * Recruiter sign-up at the end of the onboarding.
 *
 * Recruiters are passwordless, so the design's password fields are replaced by
 * the real flow — the same two actions as /talent/register: email + name +
 * company + terms, then a 6-digit code that proves the address. Registration
 * does not sign anyone in; the sign-in screen finishes that, email prefilled.
 */

export function SignupScreen() {
  const track = useTrack();
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSubmitForm =
    EMAIL_RE.test(email.trim()) &&
    fullName.trim().length >= 2 &&
    company.trim().length >= 2 &&
    acceptedTerms;

  function sendCode() {
    setError(null);
    startTransition(async () => {
      const res = await requestRecruiterOtpAction({ email, intent: "register" });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDevCode(res.data.devCode ?? null);
      setStep("code");
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await registerRecruiterWithOtpAction({
        fullName,
        company,
        email,
        code,
        acceptedTerms: true,
        newsletterOptIn,
      });
      if (!res.ok) {
        setError(res.message);
        setCode("");
        return;
      }
      track(ANALYTICS_EVENTS.recruiterRegSubmitted, { method: "otp" });
      // Registration writes the account but opens no session, so sign-in is
      // next. A full navigation, not router.push: a transition that lands on
      // a server redirect leaves useTransition pending forever.
      window.location.href = `/recruiter-onboarding/signin?email=${encodeURIComponent(email)}`;
    });
  }

  const ctaClass = cn(dsButtonVariants({ size: "lg" }), "w-full gap-2", CLAY_CTA);

  return (
    <RecruiterAuthFrame>
      <h1 className={AUTH_TITLE}>
        {step === "form" ? "Create an account" : "Verify your email"}
      </h1>

      {step === "form" ? (
        <>
          <p className={AUTH_LEAD}>
            Find top talent, manage your hiring pipeline, and connect with the
            right candidates, all from one powerful recruiter dashboard.
          </p>

          <form
            noValidate
            className={AUTH_FORM}
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmitForm && !pending) sendCode();
            }}
          >
            <AuthField
              id="su-email"
              label="Your work email"
              hint="We’ll send a 6-digit code to verify it. No password needed."
            >
              <input
                id="su-email"
                type="email"
                autoComplete="email"
                aria-describedby="su-email-hint"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className={AUTH_INPUT}
              />
            </AuthField>
            <AuthField id="su-name" label="Full name">
              <input
                id="su-name"
                autoComplete="name"
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={pending}
                className={AUTH_INPUT}
              />
            </AuthField>
            <AuthField id="su-company" label="Company">
              <input
                id="su-company"
                autoComplete="organization"
                maxLength={200}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={pending}
                className={AUTH_INPUT}
              />
            </AuthField>

            <div className="space-y-2.5 pt-1 text-sm text-[#4B4B4B]">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-4 shrink-0 accent-[#03535F]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" className="font-medium text-[#03535F] hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-medium text-[#03535F] hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-4 shrink-0 accent-[#03535F]"
                />
                <span>
                  Send me occasional updates about talent-pool access and
                  recruiter product news.
                </span>
              </label>
            </div>

            <AuthError message={error} />

            <div className={AUTH_CTA_WRAP}>
              <button
                type="submit"
                disabled={pending || !canSubmitForm}
                className={ctaClass}
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Get Started
              </button>
            </div>
          </form>
        </>
      ) : (
        <form
          noValidate
          className="mx-auto mt-6 max-w-[470px] space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6 && !pending) finish();
          }}
        >
          <p className="text-center text-base leading-[25px] text-[#626262]">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-[#161616]">{email}</span>. It
            expires in 10 minutes.
          </p>

          <DevCodeNotice code={devCode} />

          <AuthField id="su-code" label="6-digit code">
            <input
              id="su-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={pending}
              className={cn(AUTH_INPUT, "text-center font-mono text-lg tracking-[0.5em]")}
            />
          </AuthField>

          <AuthError message={error} />

          <div className={AUTH_CTA_WRAP}>
            <button
              type="submit"
              disabled={pending || code.length !== 6}
              className={ctaClass}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Complete registration
            </button>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setStep("form");
              setCode("");
              setDevCode(null);
              setError(null);
            }}
            className="mx-auto block min-h-11 text-sm text-[#626262] hover:text-[#03535F]"
          >
            Change details
          </button>
        </form>
      )}

      <p className={AUTH_FOOTNOTE}>
        Already have an account?{" "}
        <Link href="/recruiter-onboarding/signin" className={AUTH_FOOTNOTE_LINK}>
          Sign in
        </Link>
      </p>
    </RecruiterAuthFrame>
  );
}
