"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { requestRecruiterOtpAction } from "@/app/actions/recruiter-auth-actions";
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
 * Recruiter sign-in, in the onboarding's look. Same frame as sign-up.
 *
 * Recruiters are passwordless, so the design's password field is replaced by
 * the real flow — the same steps as /talent/login: request a code for the
 * email (the server refuses an address with no registration), then sign in
 * with the `recruiter-otp` provider.
 */

export function SigninScreen({ initialEmail = "" }: { initialEmail?: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestCode() {
    setError(null);
    startTransition(async () => {
      const res = await requestRecruiterOtpAction({ email, intent: "signin" });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDevCode(res.data.devCode ?? null);
      setStep("code");
    });
  }

  function submitCode() {
    setError(null);
    startTransition(async () => {
      const res = await signIn("recruiter-otp", { email, code, redirect: false });
      if (!res || res.error) {
        setError("That code isn’t right, or it has expired.");
        setCode("");
        return;
      }
      // Full navigation: the session cookie was just set and every guard
      // downstream reads it server-side. Straight to the desk — registering
      // provisions the workspace, so there is no setup or review step.
      window.location.href = "/hire";
    });
  }

  const ctaClass = cn(dsButtonVariants({ size: "lg" }), "w-full gap-2", CLAY_CTA);

  return (
    <RecruiterAuthFrame>
      <h1 className={AUTH_TITLE}>
        {step === "email" ? "Welcome Back!" : "Check your email"}
      </h1>

      {step === "email" ? (
        <>
          <p className={AUTH_LEAD}>
            Welcome back. Pick up where you left off. Review candidates, track
            conversations, and keep your hiring pipeline moving.
          </p>

          <form
            noValidate
            className={AUTH_FORM}
            onSubmit={(e) => {
              e.preventDefault();
              if (EMAIL_RE.test(email.trim()) && !pending) requestCode();
            }}
          >
            <AuthField
              id="si-email"
              label="Your work email"
              hint="We’ll email you a 6-digit code. No password needed."
            >
              <input
                id="si-email"
                type="email"
                autoComplete="email"
                autoFocus
                aria-describedby="si-email-hint"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className={AUTH_INPUT}
              />
            </AuthField>

            <AuthError message={error} />

            <div className={AUTH_CTA_WRAP}>
              <button
                type="submit"
                disabled={pending || !EMAIL_RE.test(email.trim())}
                className={ctaClass}
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Login
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
            if (code.length === 6 && !pending) submitCode();
          }}
        >
          <p className="text-center text-base leading-[25px] text-[#626262]">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-[#161616]">{email}</span>. It
            expires in 10 minutes.
          </p>

          <DevCodeNotice code={devCode} />

          <AuthField id="si-code" label="6-digit code">
            <input
              id="si-code"
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
              Login
            </button>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setStep("email");
              setCode("");
              setDevCode(null);
              setError(null);
            }}
            className="mx-auto flex min-h-11 items-center gap-1.5 text-sm text-[#626262] hover:text-[#03535F]"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Use a different email
          </button>
        </form>
      )}

      <p className={AUTH_FOOTNOTE}>
        Don’t have an account?{" "}
        <Link href="/recruiter-onboarding/signup" className={AUTH_FOOTNOTE_LINK}>
          Sign up
        </Link>
      </p>
    </RecruiterAuthFrame>
  );
}
